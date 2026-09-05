"""Request dependencies.

Identifying the caller matters for anything stored against a user account —
a preference is theirs, not the browser's — so these endpoints read the bearer
token rather than trusting a user id from the client.
"""
from fastapi import Depends, HTTPException, Header, Request
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


# --- Module permissions ----------------------------------------------------

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def permissions_for(db: Session, role_code: str) -> dict:
    """That role's module grants, as {module: {can_view, can_edit}}.

    A module with no row is closed, so a newly added module stays shut until
    somebody grants it rather than being open by default.
    """
    role = db.query(models.Role).filter(
        models.Role.code == (role_code or "").upper()).first()
    if role is None or not role.is_active:
        return {}
    return {p.module: {"can_view": bool(p.can_view), "can_edit": bool(p.can_edit)}
            for p in role.permissions}


def require_module(module: str):
    """Guard a router with one module's permission.

    The method decides which grant is needed: reading a screen needs view,
    changing anything on it needs edit. Without this the menu would only be
    hidden, and the endpoints behind it would still answer.
    """
    def _check(request: Request,
               current_user: models.User = Depends(get_current_user),
               db: Session = Depends(get_db)) -> models.User:
        grants = permissions_for(db, current_user.role)
        grant = grants.get(module)

        if not grant or not grant["can_view"]:
            raise HTTPException(
                status_code=403,
                detail=f"Your role ({current_user.role}) has no access to "
                       f"{module.replace('_', ' ').title()}")

        if request.method in WRITE_METHODS and not grant["can_edit"]:
            raise HTTPException(
                status_code=403,
                detail=f"Your role ({current_user.role}) has read-only access "
                       f"to {module.replace('_', ' ').title()}")
        return current_user

    return _check
