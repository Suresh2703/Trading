"""Builds a standard CRUD router for a master-data entity.

Every master (categories, units, customers, suppliers, taxes) exposes the same
five endpoints, so they are generated from one implementation instead of five
near-identical router modules.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional

import crud
from database import get_db


def build_master_router(*, prefix: str, tag: str, model, read_schema,
                        create_schema, update_schema, label: str,
                        dependents=()):
    """`dependents` is a list of (child_model, fk_column_name, plural_label).

    SQLAlchemy's default behaviour on delete is to NULL out the child foreign
    key, which would silently orphan records pointing at this master. For master
    data we block the delete instead and tell the caller what is using it.
    """
    router = APIRouter(prefix=prefix, tags=[tag])

    def find_blocking_dependents(db, obj_id):
        blocking = []
        for child_model, fk_column, plural in dependents:
            count = db.query(child_model).filter(
                getattr(child_model, fk_column) == obj_id
            ).count()
            if count:
                blocking.append(f"{count} {plural}")
        return blocking

    @router.get("/", response_model=List[read_schema])
    def read_many(skip: int = 0, limit: int = 100, search: Optional[str] = None,
                  db: Session = Depends(get_db)):
        return crud.get_all(db, model, skip=skip, limit=limit, search=search)

    @router.get("/{obj_id}", response_model=read_schema)
    def read_one(obj_id: int, db: Session = Depends(get_db)):
        obj = crud.get_one(db, model, obj_id)
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        return obj

    @router.post("/", response_model=read_schema, status_code=201)
    def create(payload: create_schema, db: Session = Depends(get_db)):
        try:
            return crud.create_one(db, model, payload)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"{label} already exists (name or code must be unique)"
            )

    @router.put("/{obj_id}", response_model=read_schema)
    def update(obj_id: int, payload: update_schema, db: Session = Depends(get_db)):
        try:
            obj = crud.update_one(db, model, obj_id, payload)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"{label} already exists (name or code must be unique)"
            )
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        return obj

    @router.delete("/{obj_id}")
    def delete(obj_id: int, db: Session = Depends(get_db)):
        if crud.get_one(db, model, obj_id) is None:
            raise HTTPException(status_code=404, detail=f"{label} not found")

        blocking = find_blocking_dependents(db, obj_id)
        if blocking:
            raise HTTPException(
                status_code=409,
                detail=(f"Cannot delete this {label.lower()} — it is still used by "
                        f"{' and '.join(blocking)}. Reassign them first.")
            )

        try:
            obj = crud.delete_one(db, model, obj_id)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail=f"{label} is referenced by other records and cannot be deleted"
            )
        except SQLAlchemyError as exc:
            # Anything else (e.g. a stale column in a related table) would
            # otherwise escape as a bare 500 with no CORS headers, which the
            # browser reports only as an opaque "Failed to fetch".
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Could not delete {label.lower()}: {exc.__class__.__name__}"
            )
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        return {"ok": True, "deleted_id": obj_id}

    return router
