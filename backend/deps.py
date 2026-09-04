"""Request dependencies.

Identifying the caller matters for anything stored against a user account —
a preference is theirs, not the browser's — so these endpoints read the bearer
token rather than trusting a user id from the client.
"""
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

import auth, crud, models
from database import get_db


def get_current_user(authorization: Optional[str] = Header(None),
                     db: Session = Depends(get_db)) -> models.User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")

    claims = auth.decode_access_token(authorization.split(" ", 1)[1].strip())
    if not claims:
        raise HTTPException(status_code=401, detail="Session expired — sign in again")

    user = crud.get_one(db, models.User, claims.get("id"))
    if user is None:
        raise HTTPException(status_code=401, detail="Account no longer exists")
    return user


ADMIN = "ADMIN"
USER = "USER"
ROLES = {ADMIN, USER}


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Only an administrator may manage other people's accounts."""
    if (current_user.role or USER).upper() != ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only an administrator can do that")
    return current_user


def get_optional_user(authorization: Optional[str] = Header(None),
                      db: Session = Depends(get_db)) -> Optional[models.User]:
    """The caller if they are signed in, otherwise None — never raises.

    Used where an endpoint stays open but behaves differently for an admin.
    """
    try:
        return get_current_user(authorization=authorization, db=db)
    except HTTPException:
        return None
