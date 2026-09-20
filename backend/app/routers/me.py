"""
Self-service account deletion.

POST /me/delete removes the caller's Supabase auth user. Migration 009 makes that
cascade to their members row and to every review written ABOUT them, in one
database transaction, so deletion is all-or-nothing: if Supabase refuses, nothing
is removed and the user can simply try again.

What survives, on purpose:
  * reviews the person WROTE stay, with the author cleared. A leader's assessment
    of someone else is that other person's record.
  * tasks they were assigned stay and become unassigned, so the event's plan
    doesn't silently lose work.

Deletion is irreversible. The only guard against a hijacked session is that the
caller must type their own email; it is a speed bump, not re-authentication.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user
from app.db import supabase
from app.limits import limiter

log = logging.getLogger(__name__)

router = APIRouter(prefix="/me", tags=["me"])


class DeleteAccountRequest(BaseModel):
    confirm_email: str = Field(min_length=3, max_length=320)


class DeleteAccountResponse(BaseModel):
    deleted: bool


@router.post("/delete", response_model=DeleteAccountResponse)
@limiter.limit("5/hour")  # irreversible: a loop of wrong confirmations should not be free
def delete_my_account(
    request: Request,  # required by slowapi
    body: DeleteAccountRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete the signed-in person's account and profile. Members and leaders alike."""
    row = supabase.table("members").select("email").eq("id", str(user.member_id)).limit(1).execute().data
    if not row:
        raise HTTPException(status_code=404, detail="profile not found")
    if body.confirm_email.strip().lower() != row[0]["email"].strip().lower():
        raise HTTPException(status_code=400, detail="That email doesn't match your account.")

    if user.is_leader:
        roster = supabase.table("members").select("id, role").eq("club_id", str(user.club_id)).execute().data
        leaders = sum(1 for m in roster if m["role"] == "leader")
        # A club with nobody in charge can't be managed, and migration 008's
        # "no leader yet" rule would hand leadership to the next stranger who
        # signs up. Allowed only when there is nobody left to strand.
        if leaders <= 1 and len(roster) > 1:
            raise HTTPException(
                status_code=409,
                detail=(
                    "You're the only leader in this club, so deleting your account would leave "
                    "it with nobody in charge. Make another member a leader first."
                ),
            )

    try:
        supabase.auth.admin.delete_user(str(user.auth_user_id))
    except Exception:
        # The delete is one transaction: if we are here, nothing was removed.
        log.exception("account deletion failed for member %s", user.member_id)
        raise HTTPException(
            status_code=502,
            detail="Couldn't delete your account right now. Nothing was removed; please try again.",
        )

    log.info("member %s (club %s) deleted their account", user.member_id, user.club_id)
    return DeleteAccountResponse(deleted=True)
