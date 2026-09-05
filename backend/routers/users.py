from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import crud, models, schemas
from database import get_db

from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
import auth
import models
from deps import get_current_user, get_optional_user, require_admin, ADMIN, USER, ROLES

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username) # Using email as the username field in OAuth2
    if not user:
        # fallback to username
        user = db.query(models.User).filter(models.User.username == form_data.username).first()
        
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "id": user.id}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username,
                 "email": user.email, "role": user.role or USER},
    }

def valid_role_or_400(db: Session, role: str) -> str:
    """Roles live in the database, so the set of valid codes is a query.

    Validating against a hardcoded constant would reject every role created
    through the permissions screen.
    """
    code = (role or USER).upper()
    known = db.query(models.Role).filter(models.Role.code == code).first()
    if known is None:
        available = [r.code for r in db.query(models.Role)
                     .filter(models.Role.is_active.is_(True))
                     .order_by(models.Role.id).all()]
        raise HTTPException(
            status_code=400,
            detail=f"role must be one of {', '.join(available)}")
    if not known.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"The {code} role is deactivated")
    return code


# --- Passwords -------------------------------------------------------------

MIN_PASSWORD_LENGTH = 8


def validate_new_password(new_password: str, user: models.User):
    if len(new_password or "") < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )
    # Re-saving the same password looks like it worked but changes nothing,
    # which is worse than being told.
    if crud.verify_password(new_password, user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="That is already the current password — choose a different one"
        )


@router.put("/me/password")
def change_my_password(payload: schemas.ChangePasswordRequest,
                       current_user: models.User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    """Change your own password, proving you know the current one."""
    if not crud.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    validate_new_password(payload.new_password, current_user)
    current_user.hashed_password = crud.get_password_hash(payload.new_password)
    db.commit()
    return {"ok": True, "detail": "Password changed. Sign in again with the new password."}


@router.put("/{user_id}/password")
def reset_user_password(user_id: int, payload: schemas.ResetPasswordRequest,
                        current_user: models.User = Depends(require_admin),
                        db: Session = Depends(get_db)):
    """Set another user's password without knowing their current one.

    Administrators only. It also refuses to act on the caller's own account:
    otherwise this would be a way around the current-password check on
    /me/password, and a stolen session could lock the real owner out in one
    step.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Use the change-password form for your own account, "
                   "which asks for your current password"
        )

    user = crud.get_user(db, user_id=user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    validate_new_password(payload.new_password, user)
    user.hashed_password = crud.get_password_hash(payload.new_password)
    db.commit()
    return {"ok": True, "detail": f"Password reset for {user.username}"}


# --- Preferences -----------------------------------------------------------
# Declared before /{user_id} so "me" is never parsed as an id.

@router.get("/me/preferences", response_model=schemas.UserPreferences)
def read_my_preferences(current_user: models.User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    rows = db.query(models.UserPreference).filter(
        models.UserPreference.user_id == current_user.id).all()
    return schemas.UserPreferences(
        preferences={r.pref_key: r.pref_value for r in rows})


@router.put("/me/preferences", response_model=schemas.UserPreferences)
def update_my_preferences(payload: schemas.UserPreferences,
                          current_user: models.User = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    """Merge the given keys into this user's settings.

    A merge rather than a replace, so a screen saving one preference cannot
    wipe out the ones it does not know about.
    """
    existing = {r.pref_key: r for r in db.query(models.UserPreference).filter(
        models.UserPreference.user_id == current_user.id).all()}

    for key, value in (payload.preferences or {}).items():
        key = str(key)[:60]
        value = None if value is None else str(value)[:500]
        if key in existing:
            existing[key].pref_value = value
        else:
            db.add(models.UserPreference(
                user_id=current_user.id, pref_key=key, pref_value=value))
    db.commit()

    rows = db.query(models.UserPreference).filter(
        models.UserPreference.user_id == current_user.id).all()
    return schemas.UserPreferences(
        preferences={r.pref_key: r.pref_value for r in rows})


@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate,
                caller: models.User = Depends(require_admin),
                db: Session = Depends(get_db)):
    """Create an account. Administrators only.

    Self-service signup would defeat the point of protecting the business
    endpoints: anyone could register and then reach all of them. Accounts are
    handed out, not claimed.
    """
    if crud.get_user_by_email(db, email=user.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    role = valid_role_or_400(db, user.role)

    db_user = crud.create_user(db=db, user=user)
    db_user.role = role
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/{user_id}/role", response_model=schemas.User)
def set_user_role(user_id: int, payload: schemas.UserRoleUpdate,
                  current_user: models.User = Depends(require_admin),
                  db: Session = Depends(get_db)):
    """Change someone's role. Administrators only."""
    role = valid_role_or_400(db, payload.role)

    user = crud.get_user(db, user_id=user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Removing your own admin rights could leave nobody able to restore them.
    if user.id == current_user.id and role != ADMIN:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own administrator role")

    if role != ADMIN and user.role == ADMIN:
        remaining = db.query(models.User).filter(
            models.User.role == ADMIN, models.User.id != user_id).count()
        if remaining == 0:
            raise HTTPException(
                status_code=400,
                detail="That is the last administrator — promote someone else first")

    user.role = role
    db.commit()
    db.refresh(user)
    return user

@router.get("/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100,
               current_user: models.User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@router.get("/{user_id}", response_model=schemas.User)
def read_user(user_id: int,
              current_user: models.User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user
