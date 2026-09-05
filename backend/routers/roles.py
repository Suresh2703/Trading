from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import crud, models, schemas, modules as M
from database import get_db
from deps import get_current_user, require_admin, permissions_for

router = APIRouter(prefix="/roles", tags=["roles"])


def to_schema(db: Session, role: models.Role) -> schemas.Role:
    out = schemas.Role.model_validate(role)
    out.permissions = [
        schemas.PermissionEntry(module=p.module, can_view=p.can_view,
                                can_edit=p.can_edit)
        for p in role.permissions
    ]
    # Shown on the matrix so it is obvious when a role is in use, before
    # anybody deactivates or deletes it.
    out.user_count = db.query(models.User).filter(
        models.User.role == role.code).count()
    return out


def apply_permissions(db: Session, role: models.Role,
                      entries: List[schemas.PermissionEntry]):
    """Replace this role's grants with the given set.

    Edit without view is not a coherent state, so it is normalised on the way
    in rather than stored as given. No access is the absence of a row, which
    means a module added later stays shut until somebody grants it.
    """
    for entry in entries:
        if entry.module not in M.MODULE_CODES:
            raise HTTPException(status_code=400,
                                detail=f"Unknown module '{entry.module}'")

    role.permissions.clear()
    db.flush()
    for entry in entries:
        if not entry.can_view and not entry.can_edit:
            continue
        db.add(models.RolePermission(
            role_id=role.id, module=entry.module,
            can_view=True, can_edit=bool(entry.can_edit)))


@router.get("/modules", response_model=List[schemas.ModuleInfo])
def read_modules(current_user: models.User = Depends(get_current_user)):
    """The columns of the matrix, in display order."""
    return [schemas.ModuleInfo(code=c, label=l) for c, l in M.MODULES]


@router.get("/me", response_model=schemas.MyPermissions)
def read_my_permissions(current_user: models.User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    """What the caller may reach.

    Open to anyone signed in, not just administrators — the menu cannot be
    built without it.
    """
    role = db.query(models.Role).filter(
        models.Role.code == (current_user.role or "").upper()).first()
    return schemas.MyPermissions(
        role=current_user.role or "USER",
        role_name=role.name if role else None,
        modules=permissions_for(db, current_user.role),
    )


@router.get("/", response_model=List[schemas.Role])
def read_roles(current_user: models.User = Depends(require_admin),
               db: Session = Depends(get_db)):
    roles = db.query(models.Role).order_by(models.Role.id).all()
    return [to_schema(db, r) for r in roles]


@router.post("/", response_model=schemas.Role, status_code=201)
def create_role(payload: schemas.RoleCreate,
                current_user: models.User = Depends(require_admin),
                db: Session = Depends(get_db)):
    code = (payload.code or "").strip().upper().replace(" ", "_")
    if not code:
        raise HTTPException(status_code=400, detail="Role code is required")
    if not (payload.name or "").strip():
        raise HTTPException(status_code=400, detail="Role name is required")

    role = models.Role(code=code, name=payload.name.strip(),
                       description=payload.description,
                       is_system=False, is_active=payload.is_active)
    db.add(role)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400,
                            detail=f"Role '{code}' already exists")

    apply_permissions(db, role, payload.permissions)
    db.commit()
    db.refresh(role)
    return to_schema(db, role)


@router.put("/{role_id}", response_model=schemas.Role)
def update_role(role_id: int, payload: schemas.RoleUpdate,
                current_user: models.User = Depends(require_admin),
                db: Session = Depends(get_db)):
    role = crud.get_one(db, models.Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")

    data = payload.model_dump(exclude_unset=True, exclude={"permissions"})
    if role.is_system and data.get("is_active") is False:
        raise HTTPException(
            status_code=400,
            detail=f"{role.code} is a system role and cannot be deactivated. "
                   f"It is the way back in if the matrix is misconfigured.")

    for field, value in data.items():
        setattr(role, field, value)

    if payload.permissions is not None:
        if role.is_system:
            raise HTTPException(
                status_code=400,
                detail=f"{role.code} always has full access, by design. "
                       f"Create a separate role to restrict someone.")
        apply_permissions(db, role, payload.permissions)

    db.commit()
    db.refresh(role)
    return to_schema(db, role)


@router.delete("/{role_id}")
def delete_role(role_id: int,
                current_user: models.User = Depends(require_admin),
                db: Session = Depends(get_db)):
    role = crud.get_one(db, models.Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400,
                            detail=f"{role.code} is a system role")

    # users.role stores the code, so deleting a role in use would leave those
    # accounts pointing at nothing — which reads as no access at all.
    in_use = db.query(models.User).filter(models.User.role == role.code).count()
    if in_use:
        raise HTTPException(
            status_code=409,
            detail=f"{in_use} user(s) still have the {role.code} role. "
                   f"Move them to another role first.")

    db.delete(role)
    db.commit()
    return {"ok": True, "deleted_id": role_id}
