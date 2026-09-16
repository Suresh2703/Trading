"""API keys — letting another system call this one.

A key is shown exactly once, at creation. Only its hash is stored, the same way
a password is, so a copy of the database hands over no working credentials. The
prefix is kept in clear purely so a key can be told apart in a list.

A key carries a role, and is refused anything that role could not do, so
issuing one cannot be a way around the permission matrix.
"""
import datetime
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud, models, schemas, settings_registry as reg
from database import get_db
from deps import require_admin
from routers.settings import get_value

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

PREFIX = "erp"


def to_schema(db: Session, key: models.ApiKey, plain: Optional[str] = None):
    creator = crud.get_one(db, models.User, key.created_by) if key.created_by else None
    return schemas.ApiKey(
        id=key.id, name=key.name, key_prefix=key.key_prefix, role=key.role,
        is_active=key.is_active, expires_at=key.expires_at,
        last_used_at=key.last_used_at, created_at=key.created_at,
        created_by_name=creator.username if creator else None,
        # Present only in the response that created it.
        plain_key=plain,
    )


@router.get("/", response_model=List[schemas.ApiKey])
def read_keys(db: Session = Depends(get_db),
              current_user: models.User = Depends(require_admin)):
    rows = db.query(models.ApiKey).order_by(models.ApiKey.id.desc()).all()
    return [to_schema(db, row) for row in rows]


@router.post("/", response_model=schemas.ApiKey, status_code=201)
def create_key(payload: schemas.ApiKeyCreate,
               db: Session = Depends(get_db),
               current_user: models.User = Depends(require_admin)):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the key a name")

    role = (payload.role or "VIEWER").upper()
    known = db.query(models.Role).filter(models.Role.code == role).first()
    if known is None or not known.is_active:
        raise HTTPException(
            status_code=400, detail=f"{role} is not an active role")

    # token_urlsafe, not a hand-rolled scheme: the whole value of a key is that
    # it cannot be guessed.
    secret = secrets.token_urlsafe(32)
    prefix = f"{PREFIX}_{secrets.token_hex(4)}"
    plain = f"{prefix}.{secret}"

    days = payload.expires_days
    if days is None:
        days = get_value(db, reg.API, "key_expiry_days")
    expires_at = (datetime.datetime.utcnow() + datetime.timedelta(days=days)
                  if days and days > 0 else None)

    key = models.ApiKey(
        name=name[:120],
        key_prefix=prefix,
        key_hash=crud.get_password_hash(plain),
        role=role,
        is_active=True,
        expires_at=expires_at,
        created_by=current_user.id,
    )
    db.add(key)
    db.commit()
    db.refresh(key)

    # The only time the plain key is ever returned.
    return to_schema(db, key, plain=plain)


@router.put("/{key_id}", response_model=schemas.ApiKey)
def update_key(key_id: int, payload: schemas.ApiKeyUpdate,
               db: Session = Depends(get_db),
               current_user: models.User = Depends(require_admin)):
    key = crud.get_one(db, models.ApiKey, key_id)
    if key is None:
        raise HTTPException(status_code=404, detail="Key not found")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Give the key a name")
        key.name = name[:120]
    if payload.is_active is not None:
        key.is_active = payload.is_active

    db.commit()
    db.refresh(key)
    return to_schema(db, key)


@router.delete("/{key_id}")
def delete_key(key_id: int, db: Session = Depends(get_db),
               current_user: models.User = Depends(require_admin)):
    key = crud.get_one(db, models.ApiKey, key_id)
    if key is None:
        raise HTTPException(status_code=404, detail="Key not found")
    name = key.name
    db.delete(key)
    db.commit()
    return {"detail": f"Key '{name}' deleted. Anything using it will stop working."}


# --- authentication --------------------------------------------------------

def user_for_api_key(db: Session, presented: str):
    """The caller a key stands for, or None.

    Looked up by prefix and then verified against the hash, so a wrong key
    costs one hash comparison rather than one per key on file.
    """
    if not presented or "." not in presented:
        return None
    if not get_value(db, reg.API, "keys_enabled"):
        return None

    prefix = presented.split(".", 1)[0]
    key = db.query(models.ApiKey).filter(
        models.ApiKey.key_prefix == prefix).first()
    if key is None or not key.is_active:
        return None
    if key.expires_at and key.expires_at < datetime.datetime.utcnow():
        return None
    if not crud.verify_password(presented, key.key_hash):
        return None

    key.last_used_at = datetime.datetime.utcnow()
    db.commit()

    # A key acts as a standing account with the key's role, so every existing
    # module permission check applies to it unchanged.
    holder = models.User(
        id=key.created_by or 0,
        username=f"apikey:{key.name}",
        email=f"{key.key_prefix}@api.local",
        role=key.role,
        is_active=True,
    )
    return holder
