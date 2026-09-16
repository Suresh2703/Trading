"""System configuration — settings that apply to everyone.

Reading is open to any signed-in user, because the app itself needs the values
to behave correctly. Writing is administrator-only: these decide how long a
session lasts and how weak a password may be, so they are not something an
ordinary account should be able to loosen.
"""
import datetime
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud, models, schemas, settings_registry as reg
from database import get_db
from deps import get_current_user, require_admin

router = APIRouter(prefix="/settings", tags=["settings"])


# --- reading ---------------------------------------------------------------

def stored_values(db: Session) -> dict:
    return {row.setting_key: row.setting_value
            for row in db.query(models.AppSetting).all()}


def section_values(db: Session, section: str) -> dict:
    """Effective values for a section: what is stored, over the defaults.

    A missing row means the default, so a newly added setting works before
    anyone has ever visited the screen.
    """
    stored = stored_values(db)
    out = {}
    for key, spec in reg.REGISTRY[section].items():
        raw = stored.get(reg.storage_key(section, key))
        out[key] = spec["default"] if raw is None else reg.parse(spec, raw)
    return out


def get_value(db: Session, section: str, key: str):
    """One setting, for code that needs to act on it."""
    spec = reg.spec_for(section, key)
    if spec is None:
        raise KeyError(f"unknown setting {section}.{key}")
    row = db.query(models.AppSetting).filter(
        models.AppSetting.setting_key == reg.storage_key(section, key)).first()
    return spec["default"] if row is None else reg.parse(spec, row.setting_value)


@router.get("/", response_model=List[schemas.SettingSection])
def read_all(db: Session = Depends(get_db),
             current_user: models.User = Depends(get_current_user)):
    """Every section, with each setting's value, default and bounds.

    The bounds travel with the values so the screen can render the right
    control and refuse an impossible entry before it is sent.
    """
    sections = []
    for section in reg.SECTIONS:
        values = section_values(db, section)
        fields = []
        for key, spec in reg.REGISTRY[section].items():
            fields.append(schemas.SettingField(
                key=key, label=spec["label"], help=spec["help"],
                type=spec["type"], value=values[key], default=spec["default"],
                min=spec.get("min"), max=spec.get("max"),
            ))
        sections.append(schemas.SettingSection(section=section, fields=fields))
    return sections


@router.put("/{section}", response_model=schemas.SettingSection)
def update_section(section: str, payload: schemas.SettingUpdate,
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(require_admin)):
    section = section.lower()
    if section not in reg.REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"section must be one of {', '.join(reg.SECTIONS)}")

    # Validate the whole batch before writing any of it, so a rejected value
    # cannot leave the section half-saved.
    to_write = {}
    for key, raw in (payload.values or {}).items():
        spec = reg.spec_for(section, key)
        if spec is None:
            raise HTTPException(
                status_code=400, detail=f"{section} has no setting called {key}")
        try:
            to_write[key] = reg.validate(spec, key, raw)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    for key, value in to_write.items():
        storage = reg.storage_key(section, key)
        row = db.query(models.AppSetting).filter(
            models.AppSetting.setting_key == storage).first()
        if row is None:
            row = models.AppSetting(setting_key=storage)
            db.add(row)
        row.setting_value = value
        row.updated_by = current_user.id
        row.updated_at = datetime.datetime.utcnow()

    db.commit()

    values = section_values(db, section)
    return schemas.SettingSection(
        section=section,
        fields=[schemas.SettingField(
            key=key, label=spec["label"], help=spec["help"], type=spec["type"],
            value=values[key], default=spec["default"],
            min=spec.get("min"), max=spec.get("max"))
            for key, spec in reg.REGISTRY[section].items()],
    )


# --- password policy -------------------------------------------------------

def password_problems(db: Session, password: str) -> List[str]:
    """Every way this password falls short of the configured policy.

    All of them at once rather than the first: being told about one rule at a
    time turns setting a password into a guessing game.
    """
    values = section_values(db, reg.SECURITY)
    problems = []

    if len(password or "") < values["password_min_length"]:
        problems.append(f"at least {values['password_min_length']} characters")
    if values["password_require_upper"] and not any(c.isupper() for c in password or ""):
        problems.append("an uppercase letter")
    if values["password_require_digit"] and not any(c.isdigit() for c in password or ""):
        problems.append("a digit")
    if values["password_require_symbol"] and not any(
            not c.isalnum() for c in password or ""):
        problems.append("a symbol")
    return problems


def enforce_password_policy(db: Session, password: str):
    problems = password_problems(db, password)
    if problems:
        raise HTTPException(
            status_code=400,
            detail="Password needs " + ", ".join(problems))


@router.get("/password-policy", response_model=schemas.PasswordPolicy)
def read_policy(db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    """What a password must satisfy, so a form can say so before submitting."""
    values = section_values(db, reg.SECURITY)
    return schemas.PasswordPolicy(
        min_length=values["password_min_length"],
        require_upper=values["password_require_upper"],
        require_digit=values["password_require_digit"],
        require_symbol=values["password_require_symbol"],
    )
