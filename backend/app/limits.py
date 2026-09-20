"""
Rate limiting.

Every Gemini call costs real quota, and /agent/command spends up to
MAX_TOOL_TURNS generations per request. Without a limit one authenticated
leader in a loop drains the project's quota and takes the platform down for
every other tenant -- a cross-tenant denial of service from a single valid
account.

TWO LAYERS, because one is not enough:

  1. `limiter` (slowapi decorators) -- the per-endpoint AI budget. These run
     inside the endpoint, which means AFTER dependency resolution, so they only
     ever see requests that already passed auth. That is the right place for a
     cost budget: an unauthenticated request never reaches Gemini anyway.

  2. GlobalRateLimitMiddleware -- the pre-auth flood ceiling. slowapi ships
     SlowAPIMiddleware for this, but it cannot be used here: it resolves the
     endpoint with `hasattr(route, "endpoint")` over `app.routes`, and this
     FastAPI version represents `include_router` results as `_IncludedRouter`
     objects with no `.endpoint`. `_should_exempt` then returns True for every
     routed request and the default limits never fire. Verified by flooding an
     undecorated route 130 times against a 120/minute default and getting zero
     429s. So the ceiling is implemented directly on `limits`, the library
     slowapi itself uses.

Both layers key per member, not per IP: a campus network puts a whole club
behind one address, so an IP limit would throttle innocent users and still let
a determined one rotate addresses.
"""

import hashlib
import time

from fastapi import Request
from limits import parse_many
from limits.storage import storage_from_string
from limits.strategies import MovingWindowRateLimiter
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings


def rate_key(request: Request) -> str:
    """Stable per-caller key. The token is hashed so it never reaches the
    rate-limit storage or a log line."""
    token = request.headers.get("authorization", "")
    if not token:
        return f"ip:{get_remote_address(request)}"  # unauthenticated: fall back to IP
    return "tok:" + hashlib.sha256(token.encode()).hexdigest()[:32]


# Layer 1: per-endpoint budgets, applied with @limiter.limit(...) on AI routes.
# No default_limits: SlowAPIMiddleware is not installed (see the module
# docstring), so a default here would be silently unenforced.
#
# headers_enabled MUST stay False. When True, slowapi injects X-RateLimit-*
# headers into the endpoint's return value, which requires every decorated
# endpoint to declare a `response: Response` parameter and raises
# "parameter `response` must be an instance of starlette.responses.Response"
# on any SUCCESSFUL call otherwise -- a 500 on every AI endpoint that only shows
# up on the happy path. (tests/test_rate_limit_success.py guards this.)
limiter = Limiter(
    key_func=rate_key,
    storage_uri=settings.rate_limit_storage_uri,
    headers_enabled=False,
)

# Layer 2: the pre-auth ceiling. Sync storage only -- an "async+redis://" URI
# would return a coroutine from hit() and break this middleware.
_storage = storage_from_string(settings.rate_limit_storage_uri)
_strategy = MovingWindowRateLimiter(_storage)
_GLOBAL_LIMITS = parse_many(settings.rate_limit_global)


class GlobalRateLimitMiddleware:
    """Cheap per-caller ceiling applied before routing, auth, or body parsing.

    Pure ASGI rather than BaseHTTPMiddleware: this runs on every request, so it
    should not cost a task group and a pair of memory streams to do arithmetic.
    """

    def __init__(self, app: ASGIApp, exempt_paths: frozenset[str] = frozenset()):
        self.app = app
        self.exempt_paths = exempt_paths

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") in self.exempt_paths:
            return await self.app(scope, receive, send)

        key = rate_key(Request(scope))
        for limit in _GLOBAL_LIMITS:
            if not _strategy.hit(limit, key):
                stats = _strategy.get_window_stats(limit, key)
                retry_after = max(1, int(stats.reset_time - time.time()))
                response = JSONResponse(
                    {"detail": "Too many requests. Slow down and try again shortly."},
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                )
                return await response(scope, receive, send)

        await self.app(scope, receive, send)
