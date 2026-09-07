"""Point of sale — the counter till.

A checkout is not a new kind of sales document. It raises exactly the pair a
manual counter sale would: a DELIVERY that takes the goods out of the till's
warehouse, and an INVOICE against it that books the revenue. Everything
downstream — the sales report, the GST return, receivables, the dashboard —
therefore sees an ordinary invoice and needs no knowledge of POS at all, and
stock leaves through the one path that already knows how to reverse itself.

Paid sales also post a RECEIPT so the money lands in cash or bank rather than
resting in receivables; a sale rung up "on account" deliberately does not, and
shows as outstanding like any other credit sale.
"""
import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import crud, models, schemas
from database import get_db
from deps import get_current_user
from routers import document_engine as engine
from routers import sales_documents as sales
from routers.stock_movements import available_stock

router = APIRouter(prefix="/pos", tags=["pos"])

WALK_IN_CODE = "WALKIN"
CASH_ACCOUNT = "1000"          # Cash in Hand
BANK_ACCOUNT = "1050"          # Bank Current Account
RECEIVABLE_ACCOUNT = "1100"    # Accounts Receivable

# A till takes money in a few shapes. CREDIT is the odd one out: nothing is
# collected, so it posts no receipt and the balance stays with the customer.
PAYMENT_METHODS = {
    "CASH": {"label": "Cash", "account": CASH_ACCOUNT, "takes_tender": True},
    "CARD": {"label": "Card", "account": BANK_ACCOUNT, "takes_tender": False},
    "UPI": {"label": "UPI / Wallet", "account": BANK_ACCOUNT, "takes_tender": False},
    "CREDIT": {"label": "On account", "account": None, "takes_tender": False},
}

COMPLETED = "COMPLETED"
VOID = "VOID"


# --- helpers ---------------------------------------------------------------

def account_by_code(db: Session, code: str):
    return db.query(models.ChartOfAccount).filter(
        models.ChartOfAccount.code == code).first()


def next_number(db: Session, column, prefix: str, width: int = 5) -> str:
    """The next free `PREFIX-00001`.

    Derived from the highest number already used rather than a row count, so
    deleting a document cannot make a later sale reuse a number that has
    already been printed on a receipt.
    """
    highest = 0
    for (value,) in db.query(column).filter(column.like(f"{prefix}-%")).all():
        tail = str(value).rsplit("-", 1)[-1]
        if tail.isdigit():
            highest = max(highest, int(tail))
    return "{}-{:0{}d}".format(prefix, highest + 1, width)


def walk_in_customer(db: Session):
    return db.query(models.Customer).filter(
        models.Customer.code == WALK_IN_CODE).first()


def default_warehouse(db: Session):
    active = db.query(models.Warehouse).filter(models.Warehouse.is_active.is_(True))
    return (active.filter(models.Warehouse.is_default.is_(True)).first()
            or active.order_by(models.Warehouse.id).first())


def resolve_method(method: str) -> dict:
    key = (method or "CASH").upper()
    if key not in PAYMENT_METHODS:
        raise HTTPException(
            status_code=400,
            detail="payment_method must be one of " + ", ".join(sorted(PAYMENT_METHODS)))
    return dict(code=key, **PAYMENT_METHODS[key])


def as_schema(db: Session, sale) -> schemas.PosSale:
    """Attach the cashier's name, which is not a column on the sale."""
    payload = schemas.PosSale.model_validate(sale)
    if sale.cashier_id:
        user = crud.get_one(db, models.User, sale.cashier_id)
        if user:
            return payload.model_copy(update={"cashier_name": user.username})
    return payload


# --- opening the till ------------------------------------------------------

@router.get("/terminal", response_model=schemas.PosTerminal)
def terminal(db: Session = Depends(get_db)):
    """Everything the till needs to open, in one call."""
    methods = []
    for code, cfg in PAYMENT_METHODS.items():
        account = account_by_code(db, cfg["account"]) if cfg["account"] else None
        methods.append(schemas.PosPaymentMethod(
            code=code,
            label=cfg["label"],
            account_id=account.id if account else None,
            account_name=account.name if account else None,
            takes_tender=cfg["takes_tender"],
        ))

    return schemas.PosTerminal(
        warehouse=default_warehouse(db),
        warehouses=db.query(models.Warehouse).filter(
            models.Warehouse.is_active.is_(True)).order_by(models.Warehouse.name).all(),
        walk_in_customer=walk_in_customer(db),
        customers=db.query(models.Customer).filter(
            models.Customer.is_active.is_(True)).order_by(models.Customer.name).all(),
        payment_methods=methods,
        taxes=db.query(models.Tax).filter(
            models.Tax.is_active.is_(True)).order_by(models.Tax.name).all(),
        next_receipt_no=next_number(db, models.PosSale.receipt_no, "POS"),
    )


@router.get("/products", response_model=List[schemas.PosProduct])
def search_products(q: str = "", warehouse_id: Optional[int] = None,
                    in_stock_only: bool = False, limit: int = 40,
                    db: Session = Depends(get_db)):
    """Products for the keypad, with live stock for the till's warehouse."""
    query = db.query(models.Product)
    term = (q or "").strip()
    if term:
        like = "%{}%".format(term)
        query = query.filter(
            (models.Product.ticker.ilike(like)) | (models.Product.name.ilike(like)))

    warehouse = (crud.get_one(db, models.Warehouse, warehouse_id) if warehouse_id
                 else default_warehouse(db))

    found = []
    for product in query.order_by(models.Product.ticker).limit(
            max(1, min(limit, 200))).all():
        on_hand = available_stock(db, product.id, warehouse.id) if warehouse else 0.0
        if in_stock_only and on_hand <= 0:
            continue
        found.append(schemas.PosProduct(
            id=product.id,
            ticker=product.ticker,
            name=product.name,
            current_price=product.current_price or 0.0,
            unit_name=product.unit.name if product.unit else None,
            category_name=product.category.name if product.category else None,
            on_hand=on_hand,
        ))
    return found


# --- checkout --------------------------------------------------------------

def cart_lines(payload: schemas.PosSaleCreate) -> List[schemas.SalesLineCreate]:
    return [schemas.SalesLineCreate(
        product_id=line.product_id,
        quantity=line.quantity,
        unit_price=line.unit_price,
        discount_pct=line.discount_pct,
        tax_id=line.tax_id,
    ) for line in payload.lines]


@router.post("/sales", response_model=schemas.PosSale, status_code=201)
def checkout(payload: schemas.PosSaleCreate,
             db: Session = Depends(get_db),
             current_user: models.User = Depends(get_current_user)):
    if not payload.lines:
        raise HTTPException(status_code=400, detail="Nothing in the cart")

    method = resolve_method(payload.payment_method)

    customer = (crud.get_one(db, models.Customer, payload.customer_id)
                if payload.customer_id else walk_in_customer(db))
    if customer is None:
        raise HTTPException(
            status_code=400,
            detail="No customer for this sale, and no walk-in customer exists. "
                   "Run update_db.py, or create a customer with code WALKIN.")

    warehouse = (crud.get_one(db, models.Warehouse, payload.warehouse_id)
                 if payload.warehouse_id else default_warehouse(db))
    if warehouse is None:
        raise HTTPException(
            status_code=400, detail="No warehouse to sell from — set one up first.")

    lines = cart_lines(payload)
    today = datetime.date.today()

    # The delivery takes the stock out, and is raised first: if the shelf
    # cannot cover the cart the sale must fail before anything is written.
    delivery = engine.create_document(db, sales.SPEC, schemas.SalesDocumentCreate(
        doc_type=sales.DELIVERY,
        doc_no=next_number(db, models.SalesDocument.doc_no, "POSDN"),
        doc_date=today,
        customer_id=customer.id,
        warehouse_id=warehouse.id,
        status="CONFIRMED",
        notes="Point of sale",
        lines=lines,
    ))

    def unwind():
        """Never leave stock moved for a sale that did not complete."""
        for doc_id in (getattr(invoice, "id", None), delivery.id):
            if doc_id and crud.get_one(db, models.SalesDocument, doc_id):
                engine.delete_document(db, sales.SPEC, doc_id)

    invoice = None
    try:
        # The invoice books the revenue, hung off the delivery exactly as a
        # manually raised counter invoice would be.
        invoice = engine.create_document(db, sales.SPEC, schemas.SalesDocumentCreate(
            doc_type=sales.INVOICE,
            doc_no=next_number(db, models.SalesDocument.doc_no, "POSINV"),
            doc_date=today,
            customer_id=customer.id,
            warehouse_id=warehouse.id,
            parent_id=delivery.id,
            status="CONFIRMED",
            notes="Point of sale",
            lines=lines,
        ))

        total = schemas.SalesDocument.model_validate(invoice).grand_total

        tendered = payload.amount_tendered or 0.0
        change = 0.0
        if method["takes_tender"]:
            # Half a cent of slack, so a total of 10.00 is not refused by 9.999.
            if tendered < total - 0.005:
                raise HTTPException(
                    status_code=400,
                    detail="Tendered {:.2f} does not cover the total {:.2f}".format(
                        tendered, total))
            change = round(tendered - total, 2)
        else:
            tendered = total if method["account"] else 0.0

        entry = None
        if method["account"] and total > 0:
            landing = account_by_code(db, method["account"])
            receivable = account_by_code(db, RECEIVABLE_ACCOUNT)
            if landing is None or receivable is None:
                raise HTTPException(
                    status_code=400,
                    detail="The chart of accounts is missing cash/bank or "
                           "receivables — run update_db.py to seed it.")

            entry = models.JournalEntry(
                entry_no=next_number(db, models.JournalEntry.entry_no, "POSRC"),
                entry_type="RECEIPT",
                entry_date=today,
                narration="POS sale {}".format(invoice.doc_no),
                reference_no=invoice.doc_no,
                party_type="CUSTOMER",
                party_id=customer.id,
                status="POSTED",
            )
            # Money in, receivable cleared — the sale never rests as debt.
            entry.lines.append(models.JournalLine(
                account_id=landing.id, debit=total, credit=0.0,
                line_narration="{} taken at till".format(method["label"])))
            entry.lines.append(models.JournalLine(
                account_id=receivable.id, debit=0.0, credit=total,
                line_narration="Settles {}".format(invoice.doc_no)))
            db.add(entry)
            db.flush()

        sale = models.PosSale(
            receipt_no=next_number(db, models.PosSale.receipt_no, "POS"),
            sale_date=today,
            customer_id=customer.id,
            warehouse_id=warehouse.id,
            delivery_id=delivery.id,
            invoice_id=invoice.id,
            journal_entry_id=entry.id if entry else None,
            payment_method=method["code"],
            amount_total=total,
            amount_tendered=round(tendered, 2),
            change_given=change,
            cashier_id=current_user.id,
            status=COMPLETED,
            notes=payload.notes,
        )
        db.add(sale)
        db.commit()
        db.refresh(sale)
    except Exception:
        db.rollback()
        unwind()
        raise

    return as_schema(db, sale)


# --- history and cashing up ------------------------------------------------

@router.get("/sales", response_model=List[schemas.PosSale])
def read_sales(skip: int = 0, limit: int = 50,
               date_from: Optional[datetime.date] = None,
               date_to: Optional[datetime.date] = None,
               status: Optional[str] = None,
               db: Session = Depends(get_db)):
    query = db.query(models.PosSale)
    if date_from:
        query = query.filter(models.PosSale.sale_date >= date_from)
    if date_to:
        query = query.filter(models.PosSale.sale_date <= date_to)
    if status:
        query = query.filter(models.PosSale.status == status.upper())

    rows = (query.order_by(models.PosSale.id.desc())
            .offset(skip).limit(min(limit, 200)).all())
    return [as_schema(db, row) for row in rows]


@router.get("/summary", response_model=schemas.PosSummary)
def summary(date_from: Optional[datetime.date] = None,
            date_to: Optional[datetime.date] = None,
            db: Session = Depends(get_db)):
    """What the till took, for cashing up at close."""
    today = datetime.date.today()
    start = date_from or today
    end = date_to or today

    in_range = db.query(models.PosSale).filter(
        models.PosSale.sale_date >= start, models.PosSale.sale_date <= end)

    rows = (in_range.filter(models.PosSale.status == COMPLETED)
            .with_entities(models.PosSale.payment_method,
                           func.count(models.PosSale.id),
                           func.coalesce(func.sum(models.PosSale.amount_total), 0.0))
            .group_by(models.PosSale.payment_method).all())

    voided = (in_range.filter(models.PosSale.status == VOID)
              .with_entities(func.count(models.PosSale.id),
                             func.coalesce(func.sum(models.PosSale.amount_total), 0.0))
              .first())

    by_method = [schemas.PosSummaryRow(payment_method=m, sale_count=c, total=round(t, 2))
                 for m, c, t in rows]

    return schemas.PosSummary(
        date_from=start,
        date_to=end,
        sale_count=sum(r.sale_count for r in by_method),
        gross_total=round(sum(r.total for r in by_method), 2),
        voided_count=voided[0] if voided else 0,
        voided_total=round(voided[1], 2) if voided else 0.0,
        by_method=sorted(by_method, key=lambda r: r.payment_method),
    )


@router.get("/sales/{sale_id}", response_model=schemas.PosSale)
def read_sale(sale_id: int, db: Session = Depends(get_db)):
    sale = crud.get_one(db, models.PosSale, sale_id)
    if sale is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return as_schema(db, sale)


@router.post("/sales/{sale_id}/void", response_model=schemas.PosSale)
def void_sale(sale_id: int, db: Session = Depends(get_db)):
    """Reverse a sale: stock back on the shelf, money back out.

    The documents are cancelled rather than deleted so the receipt number and
    its trail survive an audit. Cancelling the delivery is what returns the
    stock — the engine rewrites a document's movements on a status change.
    """
    sale = crud.get_one(db, models.PosSale, sale_id)
    if sale is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if sale.status == VOID:
        raise HTTPException(status_code=400, detail="This receipt is already voided")

    for doc_id in (sale.invoice_id, sale.delivery_id):
        if doc_id and crud.get_one(db, models.SalesDocument, doc_id):
            engine.update_document(db, sales.SPEC, doc_id,
                                   schemas.SalesDocumentUpdate(status="CANCELLED"),
                                   schemas.SalesLineCreate)

    # The receipt is removed outright: a cancelled entry would still read in
    # the day book as money that arrived.
    if sale.journal_entry_id:
        entry = crud.get_one(db, models.JournalEntry, sale.journal_entry_id)
        if entry:
            db.delete(entry)
        sale.journal_entry_id = None

    sale.status = VOID
    db.commit()
    db.refresh(sale)
    return as_schema(db, sale)
