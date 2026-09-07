"""Personal notes — the scratchpad behind Ctrl+N.

Every endpoint is scoped to the signed-in user. There is deliberately no way to
read or write someone else's notes, not even for an administrator: a scratchpad
people actually use will collect half-finished thoughts, and it is only useful
if it is genuinely private.

Not gated on a module, for the same reason preferences are not — a note belongs
to the person rather than to any part of the business.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models, schemas
from database import get_db
from deps import get_current_user

router = APIRouter(prefix="/notes", tags=["notes"])

MAX_TITLE = 200


def owned_note(db: Session, note_id: int, user: models.User) -> models.UserNote:
    """The note, if it belongs to the caller.

    A note belonging to someone else reports 404 rather than 403: telling an
    outsider that a note exists is itself a leak.
    """
    note = db.query(models.UserNote).filter(
        models.UserNote.id == note_id,
        models.UserNote.user_id == user.id,
    ).first()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.get("/", response_model=List[schemas.UserNote])
def read_notes(db: Session = Depends(get_db),
               current_user: models.User = Depends(get_current_user)):
    """This user's notes, pinned first then most recently touched."""
    return (db.query(models.UserNote)
            .filter(models.UserNote.user_id == current_user.id)
            .order_by(models.UserNote.pinned.desc(),
                      models.UserNote.updated_at.desc())
            .all())


@router.post("/", response_model=schemas.UserNote, status_code=201)
def create_note(payload: schemas.UserNoteCreate,
                db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    note = models.UserNote(
        user_id=current_user.id,
        title=(payload.title or "").strip()[:MAX_TITLE],
        content=payload.content,
        pinned=payload.pinned,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}", response_model=schemas.UserNote)
def update_note(note_id: int, payload: schemas.UserNoteUpdate,
                db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    note = owned_note(db, note_id, current_user)

    # exclude_unset so a save that only sends the body cannot blank the title.
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        note.title = (data["title"] or "").strip()[:MAX_TITLE]
    if "content" in data:
        note.content = data["content"]
    if "pinned" in data:
        note.pinned = bool(data["pinned"])

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    note = owned_note(db, note_id, current_user)
    title = note.title or "Untitled"
    db.delete(note)
    db.commit()
    return {"detail": f"Deleted '{title}'"}
