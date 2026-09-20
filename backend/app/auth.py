"""
Supabase JWT auth for the FastAPI backend.

The browser sends `Authorization: Bearer <supabase access token>`. We verify the
signature against the project's JWKS (public keys, so no shared secret), then load
the caller's `members` row for their role. The backend talks to Postgres with the
secret key (RLS bypassed), so every role check MUST happen here.

    get_current_user  -> any logged-in club member       (401 / 403 otherwise)
    require_leader    -> role == 'leader'                 (403 for members)
"""

from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import supabase

_bearer = HTTPBearer(auto_error=False)  # we raise our own 401 so the body is consistent


@dataclass(frozen=True)
class CurrentUser:
    auth_user_id: UUID
    member_id: UUID
    club_id: UUID
    role: str  # 'leader' | 'member'
    full_name: str

    @property
    def is_leader(self) -> bool:
        return self.role == "leader"


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    if not settings.supabase_jwks_url:
        raise RuntimeError("SUPABASE_JWKS_URL is not configured")
    return jwt.PyJWKClient(settings.supabase_jwks_url, cache_keys=True, lifespan=3600)


def _decode(token: str) -> dict:
    try:
        key = _jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=["ES256", "RS256"],  # asymmetric only: rejects `none` and HS256 tricks
            audience="authenticated",
            issuer=f"{settings.supabase_url}/auth/v1",
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Session expired. Please log in again.")
    except jwt.PyJWKClientError as e:
        # Couldn't fetch/find the signing key: bad kid, or JWKS unreachable.
        raise _unauthorized(f"Could not verify token: {e}")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token.")


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> CurrentUser:
    if creds is None:
        raise _unauthorized("Missing bearer token.")

    claims = _decode(creds.credentials)

    rows = (
        supabase.table("members")
        .select("id, club_id, role, full_name")
        .eq("auth_user_id", claims["sub"])
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=403, detail="This account is not linked to a club member.")
    m = rows[0]
    return CurrentUser(
        auth_user_id=UUID(claims["sub"]),
        member_id=UUID(m["id"]),
        club_id=UUID(m["club_id"]),
        role=m["role"],
        full_name=m["full_name"],
    )


def require_leader(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_leader:
        raise HTTPException(status_code=403, detail="Only club leaders can do this.")
    return user
