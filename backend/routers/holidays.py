"""The holiday calendar — which days the business does not work.

A holiday is stored once against a real date. One that falls on the same date
every year is marked recurring and projected into whichever year is being
viewed, so New Year's Day needs one row rather than one row per year.
"""
import calendar
import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud, models, schemas
from database import get_db
from deps import get_current_user

router = APIRouter(prefix="/holidays", tags=["holidays"])

TYPES = {"PUBLIC", "OPTIONAL", "COMPANY"}


def validate(db: Session, data: dict, holiday_id: Optional[int] = None):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the holiday a name")

    kind = (data.get("holiday_type") or "PUBLIC").upper()
    if kind not in TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"holiday_type must be one of {', '.join(sorted(TYPES))}")

    day = data.get("holiday_date")
    if day is None:
        raise HTTPException(status_code=400, detail="A holiday needs a date")

    clash = db.query(models.Holiday).filter(models.Holiday.holiday_date == day)
    if holiday_id:
        clash = clash.filter(models.Holiday.id != holiday_id)
    existing = clash.first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"{day} is already marked as '{existing.name}'")

    data["name"] = name[:150]
    data["holiday_type"] = kind
    return data


@router.get("/", response_model=List[schemas.Holiday])
def read_holidays(year: Optional[int] = None,
                  include_inactive: bool = False,
                  db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Holiday)
    if not include_inactive:
        query = query.filter(models.Holiday.is_active.is_(True))
    rows = query.order_by(models.Holiday.holiday_date).all()

    if year is None:
        return rows

    # For one year: that year's own entries, plus recurring ones from any year
    # moved onto their date in this one.
    out, taken = [], set()
    for row in rows:
        if row.holiday_date.year == year:
            out.append(row)
            taken.add((row.holiday_date.month, row.holiday_date.day))

    for row in rows:
        if not row.is_recurring or row.holiday_date.year == year:
            continue
        key = (row.holiday_date.month, row.holiday_date.day)
        # A concrete entry for this year wins over the recurring projection.
        if key in taken:
            continue
        try:
            moved = row.holiday_date.replace(year=year)
        except ValueError:
            # 29 February in a non-leap year simply does not occur.
            continue
        moved_row = schemas.Holiday.model_validate(row)
        out.append(moved_row.model_copy(
            update={"holiday_date": moved, "projected": True}))
        taken.add(key)

    return sorted(out, key=lambda h: h.holiday_date)


@router.get("/calendar", response_model=schemas.HolidayCalendar)
def read_calendar(year: int, month: Optional[int] = None,
                  db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    """Every day in a month or year, with whatever falls on it.

    Built on the server so the calendar grid does not have to re-derive which
    projected recurring holiday lands where.
    """
    if month is not None and not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month must be 1-12")

    marked = {h.holiday_date: h for h in read_holidays(
        year=year, db=db, current_user=current_user)}

    months = [month] if month else range(1, 13)
    days: List[schemas.CalendarDay] = []
    for m in months:
        for d in range(1, calendar.monthrange(year, m)[1] + 1):
            day = datetime.date(year, m, d)
            found = marked.get(day)
            days.append(schemas.CalendarDay(
                day=day,
                holiday=found,
                # Set by the projection itself; it cannot be worked out here,
                # since a projected entry carries this year's date.
                projected=bool(found is not None and getattr(found, "projected", False)),
                is_weekend=day.weekday() >= 5,
            ))

    return schemas.HolidayCalendar(
        year=year, month=month, days=days,
        holiday_count=sum(1 for d in days if d.holiday is not None),
    )


@router.post("/", response_model=schemas.Holiday, status_code=201)
def create_holiday(payload: schemas.HolidayCreate,
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    data = validate(db, payload.model_dump())
    holiday = models.Holiday(**data, created_by=current_user.id)
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.put("/{holiday_id}", response_model=schemas.Holiday)
def update_holiday(holiday_id: int, payload: schemas.HolidayUpdate,
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    holiday = crud.get_one(db, models.Holiday, holiday_id)
    if holiday is None:
        raise HTTPException(status_code=404, detail="Holiday not found")

    data = payload.model_dump(exclude_unset=True)
    merged = {
        "holiday_date": data.get("holiday_date", holiday.holiday_date),
        "name": data.get("name", holiday.name),
        "holiday_type": data.get("holiday_type", holiday.holiday_type),
    }
    validate(db, merged, holiday_id=holiday_id)

    for field, value in {**data, **merged}.items():
        setattr(holiday, field, value)

    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    holiday = crud.get_one(db, models.Holiday, holiday_id)
    if holiday is None:
        raise HTTPException(status_code=404, detail="Holiday not found")
    name, day = holiday.name, holiday.holiday_date
    db.delete(holiday)
    db.commit()
    return {"detail": f"Unmarked {day} ({name})"}
