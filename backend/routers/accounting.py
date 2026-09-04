"""Double-entry accounting: chart of accounts, journals, and the reports.

Every Accounts screen is a view over two tables. Journal entries hold the
movements; the chart classifies them. Ledgers, trial balance, P&L and balance
sheet are all derived on read — nothing carries a stored running balance that
could drift out of step with the entries beneath it.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional
from datetime import date

import crud, models, schemas
from database import get_db

router = APIRouter(prefix="/accounting", tags=["accounting"])

ASSET, LIABILITY, EQUITY, INCOME, EXPENSE = (
    "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE")
ACCOUNT_TYPES = {ASSET, LIABILITY, EQUITY, INCOME, EXPENSE}

# Types whose balance naturally sits on the debit side.
DEBIT_NATURE = {ASSET, EXPENSE}

ACCOUNT_GROUPS = {
    "CASH", "BANK", "RECEIVABLE", "PAYABLE", "TAX",
    "CURRENT_ASSET", "FIXED_ASSET", "CURRENT_LIABILITY", "LOAN",
    "CAPITAL", "RESERVE", "DIRECT_INCOME", "INDIRECT_INCOME",
    "DIRECT_EXPENSE", "INDIRECT_EXPENSE", "OTHER",
}

ENTRY_TYPES = {"JOURNAL", "PAYMENT", "RECEIPT", "EXPENSE", "CONTRA"}
ENTRY_STATUSES = {"DRAFT", "POSTED", "CANCELLED"}

# Rounding tolerance for the balance check — float sums rarely land on zero.
EPSILON = 0.005


def signed_balance(account_type: str, debit: float, credit: float) -> float:
    """Balance in the account's own natural direction, so it reads positive."""
    return debit - credit if account_type in DEBIT_NATURE else credit - debit


def opening_signed(account: models.ChartOfAccount) -> float:
    amount = account.opening_balance or 0.0
    if not amount:
        return 0.0
    on_debit = bool(account.opening_is_debit)
    natural_debit = account.account_type in DEBIT_NATURE
    return amount if on_debit == natural_debit else -amount


def party_name(db: Session, party_type: Optional[str], party_id: Optional[int]) -> Optional[str]:
    if not party_type or not party_id:
        return None
    model = models.Customer if party_type.upper() == "CUSTOMER" else models.Supplier
    party = crud.get_one(db, model, party_id)
    return party.name if party else None


def posted_lines(db: Session, *, account_id=None, date_from=None, date_to=None,
                 account_ids=None):
    """Journal lines that count: cancelled vouchers are excluded everywhere."""
    query = (db.query(models.JournalLine, models.JournalEntry)
               .join(models.JournalEntry, models.JournalLine.entry_id == models.JournalEntry.id)
               .filter(models.JournalEntry.status != "CANCELLED"))
    if account_id is not None:
        query = query.filter(models.JournalLine.account_id == account_id)
    if account_ids is not None:
        query = query.filter(models.JournalLine.account_id.in_(account_ids))
    if date_from:
        query = query.filter(models.JournalEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(models.JournalEntry.entry_date <= date_to)
    return query


# --- Chart of accounts -----------------------------------------------------

def validate_account(db: Session, data: dict, account_id: Optional[int] = None):
    if not (data.get("code") or "").strip():
        raise HTTPException(status_code=400, detail="Account code is required")
    if not (data.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Account name is required")

    acc_type = (data.get("account_type") or "").upper()
    if acc_type not in ACCOUNT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"account_type must be one of {', '.join(sorted(ACCOUNT_TYPES))}"
        )

    group = (data.get("account_group") or "OTHER").upper()
    if group not in ACCOUNT_GROUPS:
        raise HTTPException(
            status_code=400,
            detail=f"account_group must be one of {', '.join(sorted(ACCOUNT_GROUPS))}"
        )

    if (data.get("opening_balance") or 0) < 0:
        raise HTTPException(
            status_code=400,
            detail="Opening balance cannot be negative — use the debit/credit switch instead"
        )

    parent_id = data.get("parent_id")
    if parent_id:
        if parent_id == account_id:
            raise HTTPException(status_code=400, detail="An account cannot be its own parent")
        parent = crud.get_one(db, models.ChartOfAccount, parent_id)
        if parent is None:
            raise HTTPException(status_code=400, detail="Parent account does not exist")
        # Walk up to make sure the new link does not create a cycle.
        seen, cursor = {account_id}, parent
        while cursor is not None:
            if cursor.id in seen:
                raise HTTPException(
                    status_code=400,
                    detail="That parent would create a loop in the account tree"
                )
            seen.add(cursor.id)
            cursor = crud.get_one(db, models.ChartOfAccount, cursor.parent_id) \
                if cursor.parent_id else None


@router.get("/chart", response_model=List[schemas.ChartOfAccount])
def read_chart(skip: int = 0, limit: int = 500,
               account_type: Optional[str] = None,
               account_group: Optional[str] = None,
               account_groups: Optional[str] = None,
               db: Session = Depends(get_db)):
    """`account_groups` takes a comma-separated list, so a screen spanning more
    than one group (cash *and* bank) needs a single request rather than two."""
    query = db.query(models.ChartOfAccount)
    if account_type:
        query = query.filter(models.ChartOfAccount.account_type == account_type.upper())
    if account_group:
        query = query.filter(models.ChartOfAccount.account_group == account_group.upper())
    if account_groups:
        wanted = [g.strip().upper() for g in account_groups.split(",") if g.strip()]
        if wanted:
            query = query.filter(models.ChartOfAccount.account_group.in_(wanted))
    return query.order_by(models.ChartOfAccount.code).offset(skip).limit(limit).all()


@router.get("/chart/{account_id}", response_model=schemas.ChartOfAccount)
def read_account(account_id: int, db: Session = Depends(get_db)):
    account = crud.get_one(db, models.ChartOfAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("/chart", response_model=schemas.ChartOfAccount, status_code=201)
def create_account(payload: schemas.ChartOfAccountCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["account_type"] = data["account_type"].upper()
    data["account_group"] = (data.get("account_group") or "OTHER").upper()
    validate_account(db, data)
    try:
        return crud.create_one(db, models.ChartOfAccount, schemas.ChartOfAccountCreate(**data))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Account code '{payload.code}' already exists")


@router.put("/chart/{account_id}", response_model=schemas.ChartOfAccount)
def update_account(account_id: int, payload: schemas.ChartOfAccountUpdate,
                   db: Session = Depends(get_db)):
    account = crud.get_one(db, models.ChartOfAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    data = {
        "code": account.code, "name": account.name,
        "account_type": account.account_type, "account_group": account.account_group,
        "parent_id": account.parent_id, "opening_balance": account.opening_balance,
    }
    data.update(payload.model_dump(exclude_unset=True))
    data["account_type"] = (data.get("account_type") or "").upper()
    data["account_group"] = (data.get("account_group") or "OTHER").upper()
    validate_account(db, data, account_id=account_id)

    try:
        return crud.update_one(db, models.ChartOfAccount, account_id, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="That account code is already used")


@router.delete("/chart/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = crud.get_one(db, models.ChartOfAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    used = db.query(models.JournalLine).filter(
        models.JournalLine.account_id == account_id).count()
    if used:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete — {used} journal line(s) post to this account."
        )
    children = db.query(models.ChartOfAccount).filter(
        models.ChartOfAccount.parent_id == account_id).count()
    if children:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete — {children} account(s) sit under this one."
        )

    crud.delete_one(db, models.ChartOfAccount, account_id)
    return {"ok": True, "deleted_id": account_id}


# --- Journal entries -------------------------------------------------------

def validate_entry(db: Session, data: dict, lines: List[schemas.JournalLineCreate]):
    if not (data.get("entry_no") or "").strip():
        raise HTTPException(status_code=400, detail="Entry number is required")

    entry_type = (data.get("entry_type") or "JOURNAL").upper()
    if entry_type not in ENTRY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"entry_type must be one of {', '.join(sorted(ENTRY_TYPES))}"
        )

    status = (data.get("status") or "POSTED").upper()
    if status not in ENTRY_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {', '.join(sorted(ENTRY_STATUSES))}"
        )

    party_type = data.get("party_type")
    if party_type:
        if party_type.upper() not in {"CUSTOMER", "SUPPLIER"}:
            raise HTTPException(status_code=400, detail="party_type must be CUSTOMER or SUPPLIER")
        label = party_type.lower()
        # Naming a party type but no party is an incomplete entry, not a
        # missing record — say which of the two actually went wrong.
        if not data.get("party_id"):
            raise HTTPException(
                status_code=400,
                detail=f"Choose the {label} this entry belongs to")
        model = models.Customer if party_type.upper() == "CUSTOMER" else models.Supplier
        if crud.get_one(db, model, data["party_id"]) is None:
            raise HTTPException(status_code=400, detail=f"Selected {label} does not exist")

    if len(lines) < 2:
        raise HTTPException(
            status_code=400,
            detail="A journal entry needs at least two lines — one debit and one credit"
        )

    # A movement on a receivable or payable control account is a party
    # settlement: without a party it lands in the "Unallocated" bucket and no
    # statement can explain it. Receivables & Payables is the screen that owns
    # this, so anything posted elsewhere is held to the same rule.
    control_accounts = {
        a.id: a for a in db.query(models.ChartOfAccount).filter(
            models.ChartOfAccount.account_group.in_(["RECEIVABLE", "PAYABLE"])).all()
    }
    touched = [control_accounts[l.account_id] for l in lines
               if l.account_id in control_accounts]
    if touched and not (party_type and data.get("party_id")):
        names = ", ".join(sorted({f"{a.code} {a.name}" for a in touched}))
        raise HTTPException(
            status_code=400,
            detail=(f"This entry moves {names}, which is a party balance. "
                    f"Name the customer or supplier it belongs to — or record it "
                    f"from Receivables & Payables, which does that for you.")
        )

    total_debit = total_credit = 0.0
    for idx, line in enumerate(lines, start=1):
        if crud.get_one(db, models.ChartOfAccount, line.account_id) is None:
            raise HTTPException(status_code=400, detail=f"Line {idx}: account does not exist")
        debit, credit = line.debit or 0.0, line.credit or 0.0
        if debit < 0 or credit < 0:
            raise HTTPException(status_code=400, detail=f"Line {idx}: amounts cannot be negative")
        if debit > 0 and credit > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Line {idx}: put an amount in debit or credit, not both"
            )
        if debit == 0 and credit == 0:
            raise HTTPException(status_code=400, detail=f"Line {idx}: enter a debit or a credit amount")
        total_debit += debit
        total_credit += credit

    if abs(total_debit - total_credit) > EPSILON:
        difference = abs(total_debit - total_credit)
        raise HTTPException(
            status_code=400,
            detail=(f"Entry does not balance: debits {total_debit:.2f} vs credits "
                    f"{total_credit:.2f}, out by {difference:.2f}.")
        )


def with_party(db: Session, entry: models.JournalEntry) -> schemas.JournalEntry:
    out = schemas.JournalEntry.model_validate(entry)
    out.party_name = party_name(db, entry.party_type, entry.party_id)
    return out


@router.get("/entries", response_model=List[schemas.JournalEntry])
def read_entries(skip: int = 0, limit: int = 300,
                 entry_type: Optional[str] = None,
                 entry_types: Optional[str] = None,
                 status: Optional[str] = None,
                 account_id: Optional[int] = None,
                 party_type: Optional[str] = None,
                 party_id: Optional[int] = None,
                 date_from: Optional[date] = None,
                 date_to: Optional[date] = None,
                 db: Session = Depends(get_db)):
    query = db.query(models.JournalEntry)
    if entry_type:
        query = query.filter(models.JournalEntry.entry_type == entry_type.upper())
    # Comma-separated, so a screen covering more than one voucher type (payments
    # and receipts together) needs a single request rather than one per type.
    if entry_types:
        wanted = [t.strip().upper() for t in entry_types.split(",") if t.strip()]
        if wanted:
            query = query.filter(models.JournalEntry.entry_type.in_(wanted))
    if status:
        query = query.filter(models.JournalEntry.status == status.upper())
    if party_type:
        query = query.filter(models.JournalEntry.party_type == party_type.upper())
    if party_id is not None:
        query = query.filter(models.JournalEntry.party_id == party_id)
    if date_from:
        query = query.filter(models.JournalEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(models.JournalEntry.entry_date <= date_to)
    if account_id is not None:
        query = query.filter(models.JournalEntry.id.in_(
            db.query(models.JournalLine.entry_id).filter(
                models.JournalLine.account_id == account_id)
        ))

    rows = (query.order_by(models.JournalEntry.entry_date.desc(),
                           models.JournalEntry.id.desc())
                 .offset(skip).limit(limit).all())
    return [with_party(db, e) for e in rows]


@router.get("/entries/{entry_id}", response_model=schemas.JournalEntry)
def read_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = crud.get_one(db, models.JournalEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return with_party(db, entry)


@router.post("/entries", response_model=schemas.JournalEntry, status_code=201)
def create_entry(payload: schemas.JournalEntryCreate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"lines"})
    data["entry_type"] = (data.get("entry_type") or "JOURNAL").upper()
    data["status"] = (data.get("status") or "POSTED").upper()
    if data.get("party_type"):
        data["party_type"] = data["party_type"].upper()

    validate_entry(db, data, payload.lines)

    entry = models.JournalEntry(**data)
    for line in payload.lines:
        entry.lines.append(models.JournalLine(**line.model_dump()))
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Entry number '{payload.entry_no}' already exists"
        )
    db.refresh(entry)
    return with_party(db, entry)


@router.put("/entries/{entry_id}", response_model=schemas.JournalEntry)
def update_entry(entry_id: int, payload: schemas.JournalEntryUpdate,
                 db: Session = Depends(get_db)):
    entry = crud.get_one(db, models.JournalEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    patch = payload.model_dump(exclude_unset=True, exclude={"lines"})
    data = {
        "entry_no": entry.entry_no, "entry_type": entry.entry_type,
        "entry_date": entry.entry_date, "narration": entry.narration,
        "reference_no": entry.reference_no, "party_type": entry.party_type,
        "party_id": entry.party_id, "status": entry.status,
    }
    data.update(patch)
    data["status"] = (data.get("status") or "POSTED").upper()
    if data.get("party_type"):
        data["party_type"] = data["party_type"].upper()

    lines = payload.lines if payload.lines is not None else [
        schemas.JournalLineCreate(
            account_id=l.account_id, debit=l.debit, credit=l.credit,
            line_narration=l.line_narration
        ) for l in entry.lines
    ]
    validate_entry(db, data, lines)

    for field, value in data.items():
        setattr(entry, field, value)
    if payload.lines is not None:
        entry.lines.clear()
        db.flush()
        for line in payload.lines:
            entry.lines.append(models.JournalLine(**line.model_dump()))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="That entry number is already used")
    db.refresh(entry)
    return with_party(db, entry)


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = crud.get_one(db, models.JournalEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    try:
        db.delete(entry)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not delete entry: {exc.__class__.__name__}"
        )
    return {"ok": True, "deleted_id": entry_id}


# --- Reports ---------------------------------------------------------------

@router.get("/cash-bank", response_model=schemas.CashBankSummary)
def read_cash_bank(as_of: Optional[date] = None, db: Session = Depends(get_db)):
    """Every cash and bank account with its balance.

    Backs the combined Cash & Bank Voucher screen: one call gives the money
    on hand across both groups rather than a request per account.
    """
    accounts = (db.query(models.ChartOfAccount)
                  .filter(models.ChartOfAccount.account_group.in_(["CASH", "BANK"]))
                  .order_by(models.ChartOfAccount.code).all())
    if not accounts:
        return schemas.CashBankSummary()

    totals = {a.id: {"debit": 0.0, "credit": 0.0} for a in accounts}
    for line, entry in posted_lines(db, account_ids=list(totals), date_to=as_of).all():
        bucket = totals.get(line.account_id)
        if bucket is None:
            continue
        bucket["debit"] += line.debit or 0.0
        bucket["credit"] += line.credit or 0.0

    rows, total_cash, total_bank = [], 0.0, 0.0
    for account in accounts:
        bucket = totals[account.id]
        balance = opening_signed(account) + signed_balance(
            account.account_type, bucket["debit"], bucket["credit"])
        if account.account_group == "CASH":
            total_cash += balance
        else:
            total_bank += balance
        rows.append(schemas.CashBankAccount(
            account_id=account.id, code=account.code, name=account.name,
            account_group=account.account_group, balance=round(balance, 2),
        ))

    return schemas.CashBankSummary(
        accounts=rows, total_cash=round(total_cash, 2),
        total_bank=round(total_bank, 2),
        total=round(total_cash + total_bank, 2),
    )


@router.get("/ledger", response_model=schemas.LedgerReport)
def read_ledger(account_id: int,
                date_from: Optional[date] = None,
                date_to: Optional[date] = None,
                db: Session = Depends(get_db)):
    """One account's movements with a running balance.

    The opening figure includes both the account's stated opening balance and
    anything posted before `date_from`, so a date-filtered ledger still starts
    from the right place.
    """
    account = crud.get_one(db, models.ChartOfAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")

    opening = opening_signed(account)
    if date_from:
        for line, entry in posted_lines(db, account_id=account_id, date_to=None).filter(
                models.JournalEntry.entry_date < date_from).all():
            opening += signed_balance(account.account_type, line.debit or 0.0, line.credit or 0.0)

    rows = posted_lines(db, account_id=account_id,
                        date_from=date_from, date_to=date_to).order_by(
        models.JournalEntry.entry_date, models.JournalEntry.id).all()

    balance = opening
    total_debit = total_credit = 0.0
    lines = []
    for line, entry in rows:
        debit, credit = line.debit or 0.0, line.credit or 0.0
        balance += signed_balance(account.account_type, debit, credit)
        total_debit += debit
        total_credit += credit

        # Name the other side(s) of the voucher, the way a ledger normally reads.
        others = [
            other.account.code + " " + other.account.name
            for other in entry.lines
            if other.account_id != account_id and other.account
        ]
        lines.append(schemas.LedgerLine(
            entry_id=entry.id, entry_no=entry.entry_no, entry_date=entry.entry_date,
            entry_type=entry.entry_type, narration=line.line_narration or entry.narration,
            reference_no=entry.reference_no,
            contra_accounts=", ".join(dict.fromkeys(others)),
            debit=round(debit, 2), credit=round(credit, 2),
            running_balance=round(balance, 2),
        ))

    return schemas.LedgerReport(
        account_id=account.id, code=account.code, name=account.name,
        account_type=account.account_type, account_group=account.account_group,
        opening_balance=round(opening, 2),
        total_debit=round(total_debit, 2), total_credit=round(total_credit, 2),
        closing_balance=round(balance, 2), lines=lines,
    )


def account_totals(db: Session, as_of: Optional[date] = None,
                   date_from: Optional[date] = None):
    """Signed balance per account, opening included."""
    accounts = db.query(models.ChartOfAccount).order_by(models.ChartOfAccount.code).all()
    totals = {a.id: {"account": a, "debit": 0.0, "credit": 0.0} for a in accounts}

    for line, entry in posted_lines(db, date_from=date_from, date_to=as_of).all():
        bucket = totals.get(line.account_id)
        if bucket is None:
            continue
        bucket["debit"] += line.debit or 0.0
        bucket["credit"] += line.credit or 0.0

    return totals


@router.get("/trial-balance", response_model=schemas.TrialBalance)
def read_trial_balance(as_of: Optional[date] = None, db: Session = Depends(get_db)):
    totals = account_totals(db, as_of=as_of)

    rows = []
    total_debit = total_credit = 0.0
    for bucket in totals.values():
        account = bucket["account"]
        balance = opening_signed(account) + signed_balance(
            account.account_type, bucket["debit"], bucket["credit"])
        if abs(balance) < EPSILON:
            continue

        # Present each balance on the side it naturally belongs.
        on_debit = (balance > 0) == (account.account_type in DEBIT_NATURE)
        debit = abs(balance) if on_debit else 0.0
        credit = 0.0 if on_debit else abs(balance)
        total_debit += debit
        total_credit += credit

        rows.append(schemas.TrialBalanceRow(
            account_id=account.id, code=account.code, name=account.name,
            account_type=account.account_type, account_group=account.account_group,
            debit=round(debit, 2), credit=round(credit, 2),
        ))

    return schemas.TrialBalance(
        rows=rows, total_debit=round(total_debit, 2), total_credit=round(total_credit, 2),
        is_balanced=abs(total_debit - total_credit) < EPSILON,
    )


def section(db: Session, totals: dict, types: set, title: str) -> schemas.ReportSection:
    rows, running = [], 0.0
    for bucket in totals.values():
        account = bucket["account"]
        if account.account_type not in types:
            continue
        balance = opening_signed(account) + signed_balance(
            account.account_type, bucket["debit"], bucket["credit"])
        if abs(balance) < EPSILON:
            continue
        running += balance
        rows.append(schemas.TrialBalanceRow(
            account_id=account.id, code=account.code, name=account.name,
            account_type=account.account_type, account_group=account.account_group,
            debit=round(balance, 2) if balance > 0 else 0.0,
            credit=round(-balance, 2) if balance < 0 else 0.0,
        ))
    return schemas.ReportSection(title=title, rows=rows, total=round(running, 2))


@router.get("/profit-loss", response_model=schemas.ProfitAndLoss)
def read_profit_loss(date_from: Optional[date] = None,
                     date_to: Optional[date] = None,
                     db: Session = Depends(get_db)):
    """Income less expenses for the period.

    Opening balances are ignored for P&L accounts — they belong to earlier
    periods, so only movements inside the window count.
    """
    accounts = db.query(models.ChartOfAccount).order_by(models.ChartOfAccount.code).all()
    totals = {a.id: {"account": a, "debit": 0.0, "credit": 0.0}
              for a in accounts if a.account_type in {INCOME, EXPENSE}}

    for line, entry in posted_lines(db, date_from=date_from, date_to=date_to).all():
        bucket = totals.get(line.account_id)
        if bucket is None:
            continue
        bucket["debit"] += line.debit or 0.0
        bucket["credit"] += line.credit or 0.0

    def build(types, title):
        rows, running = [], 0.0
        for bucket in totals.values():
            account = bucket["account"]
            if account.account_type not in types:
                continue
            balance = signed_balance(account.account_type, bucket["debit"], bucket["credit"])
            if abs(balance) < EPSILON:
                continue
            running += balance
            rows.append(schemas.TrialBalanceRow(
                account_id=account.id, code=account.code, name=account.name,
                account_type=account.account_type, account_group=account.account_group,
                debit=0.0, credit=round(balance, 2),
            ))
        return schemas.ReportSection(title=title, rows=rows, total=round(running, 2))

    income = build({INCOME}, "Income")
    expenses = build({EXPENSE}, "Expenses")
    return schemas.ProfitAndLoss(
        income=income, expenses=expenses,
        net_profit=round(income.total - expenses.total, 2),
    )


@router.get("/balance-sheet", response_model=schemas.BalanceSheet)
def read_balance_sheet(as_of: Optional[date] = None, db: Session = Depends(get_db)):
    """Assets against liabilities plus equity, with profit carried in.

    Net profit is added to the equity side rather than stored, so the sheet
    balances without a period-close posting.
    """
    totals = account_totals(db, as_of=as_of)

    assets = section(db, totals, {ASSET}, "Assets")
    liabilities = section(db, totals, {LIABILITY}, "Liabilities")
    equity = section(db, totals, {EQUITY}, "Equity")

    pnl = read_profit_loss(date_from=None, date_to=as_of, db=db)
    total_assets = assets.total
    total_other = liabilities.total + equity.total + pnl.net_profit

    return schemas.BalanceSheet(
        assets=assets, liabilities=liabilities, equity=equity,
        net_profit=pnl.net_profit,
        total_assets=round(total_assets, 2),
        total_liabilities_and_equity=round(total_other, 2),
        is_balanced=abs(total_assets - total_other) < EPSILON,
    )


@router.get("/party-balances", response_model=List[schemas.PartyBalance])
def read_party_balances(group: str = Query(..., description="RECEIVABLE or PAYABLE"),
                        as_of: Optional[date] = None,
                        db: Session = Depends(get_db)):
    """Outstanding per customer or supplier, from the AR/AP control accounts."""
    group = group.upper()
    if group not in {"RECEIVABLE", "PAYABLE"}:
        raise HTTPException(status_code=400, detail="group must be RECEIVABLE or PAYABLE")

    account_ids = [a.id for a in db.query(models.ChartOfAccount).filter(
        models.ChartOfAccount.account_group == group).all()]
    if not account_ids:
        return []

    buckets = {}
    for line, entry in posted_lines(db, account_ids=account_ids, date_to=as_of).all():
        key = (entry.party_type or "UNALLOCATED", entry.party_id)
        bucket = buckets.setdefault(key, {"debit": 0.0, "credit": 0.0})
        bucket["debit"] += line.debit or 0.0
        bucket["credit"] += line.credit or 0.0

    out = []
    for (ptype, pid), bucket in buckets.items():
        # Receivables are an asset (debit positive); payables a liability.
        balance = (bucket["debit"] - bucket["credit"]) if group == "RECEIVABLE" \
            else (bucket["credit"] - bucket["debit"])
        name = party_name(db, ptype, pid) or "Unallocated"
        out.append(schemas.PartyBalance(
            party_type=ptype, party_id=pid, party_name=name,
            debit=round(bucket["debit"], 2), credit=round(bucket["credit"], 2),
            balance=round(balance, 2),
        ))

    out.sort(key=lambda r: -abs(r.balance))
    return out
