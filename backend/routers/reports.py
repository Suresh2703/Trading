"""Reports — aggregations over records that already exist.

Nothing here introduces a table. A stored report would be a second copy of the
truth that drifts the moment a document is edited, so every figure is computed
from the underlying sales documents, purchase documents, stock movements and
journal entries at the moment it is asked for.

The ledger and financial-statement screens are served by the accounting router
directly; this module adds the operational reports on top of it.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import date

import models, schemas
from database import get_db
from routers import accounting
from routers.stock_movements import read_balances

router = APIRouter(prefix="/reports", tags=["reports"])

SALES_TYPES = {"QUOTATION", "ORDER", "DELIVERY", "INVOICE", "RETURN", "CREDIT_NOTE"}
PURCHASE_TYPES = {"ORDER", "RECEIPT", "INVOICE", "RETURN", "DEBIT_NOTE"}


def line_money(line) -> tuple:
    """Subtotal and tax for one document line, matching the schema's maths."""
    gross = (line.quantity or 0.0) * (line.unit_price or 0.0)
    subtotal = gross * (1 - (line.discount_pct or 0.0) / 100.0)
    rate = line.tax.rate if line.tax else 0.0
    return subtotal, subtotal * (rate or 0.0) / 100.0


def bump(bucket: Dict, key: str, label: str, *, count=0, quantity=0.0,
         subtotal=0.0, tax=0.0):
    row = bucket.setdefault(key, {
        "key": key, "label": label, "count": 0, "quantity": 0.0,
        "subtotal": 0.0, "tax": 0.0,
    })
    row["count"] += count
    row["quantity"] += quantity
    row["subtotal"] += subtotal
    row["tax"] += tax


def finish(bucket: Dict, *, sort_by_total=True) -> List[schemas.ReportBreakdownRow]:
    rows = [schemas.ReportBreakdownRow(
        key=r["key"], label=r["label"], count=r["count"],
        quantity=round(r["quantity"], 2), subtotal=round(r["subtotal"], 2),
        tax=round(r["tax"], 2), total=round(r["subtotal"] + r["tax"], 2),
    ) for r in bucket.values()]
    rows.sort(key=lambda r: -r.total if sort_by_total else r.key)
    return rows


def build_document_report(db: Session, *, model, line_model, party_attr,
                          doc_type: str, date_from, date_to,
                          allowed_types, status=None) -> schemas.DocumentReport:
    """Summarise one document type.

    Cancelled documents are always excluded. `status` narrows further — the
    dashboard passes CONFIRMED so unfinished drafts are not reported as
    revenue, while the report screens leave it open and show the split.
    """
    doc_type = doc_type.upper()
    if doc_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"doc_type must be one of {', '.join(sorted(allowed_types))}"
        )

    query = db.query(model).filter(
        model.doc_type == doc_type,
        model.status != "CANCELLED",
    )
    if status:
        query = query.filter(model.status == status.upper())
    if date_from:
        query = query.filter(model.doc_date >= date_from)
    if date_to:
        query = query.filter(model.doc_date <= date_to)
    documents = query.all()

    by_party, by_product, by_period, by_status = {}, {}, {}, {}
    subtotal_all = tax_all = 0.0

    for doc in documents:
        doc_subtotal = doc_tax = 0.0
        for line in doc.lines:
            subtotal, tax = line_money(line)
            doc_subtotal += subtotal
            doc_tax += tax
            product = line.product
            key = product.ticker if product else f"#{line.product_id}"
            label = f"{key} — {product.name}" if product else key
            bump(by_product, key, label, quantity=line.quantity or 0.0,
                 subtotal=subtotal, tax=tax)

        subtotal_all += doc_subtotal
        tax_all += doc_tax

        party = getattr(doc, party_attr, None)
        pkey = party.code if party else "UNKNOWN"
        plabel = party.name if party else "Unknown"
        bump(by_party, pkey, plabel, count=1, subtotal=doc_subtotal, tax=doc_tax)

        period = doc.doc_date.strftime("%Y-%m")
        bump(by_period, period, period, count=1, subtotal=doc_subtotal, tax=doc_tax)

        bump(by_status, doc.status, doc.status, count=1,
             subtotal=doc_subtotal, tax=doc_tax)

    return schemas.DocumentReport(
        doc_type=doc_type, date_from=date_from, date_to=date_to,
        document_count=len(documents),
        subtotal=round(subtotal_all, 2), tax_total=round(tax_all, 2),
        grand_total=round(subtotal_all + tax_all, 2),
        by_party=finish(by_party), by_product=finish(by_product),
        by_period=finish(by_period, sort_by_total=False),
        by_status=finish(by_status),
    )


@router.get("/sales", response_model=schemas.DocumentReport)
def sales_report(doc_type: str = "INVOICE",
                 date_from: Optional[date] = None,
                 date_to: Optional[date] = None,
                 db: Session = Depends(get_db)):
    """Sales by customer, product and month.

    Defaults to INVOICE because that is the revenue document — counting orders
    and deliveries alongside it would report the same sale more than once.
    """
    return build_document_report(
        db, model=models.SalesDocument, line_model=models.SalesDocumentLine,
        party_attr="customer", doc_type=doc_type,
        date_from=date_from, date_to=date_to, allowed_types=SALES_TYPES)


@router.get("/purchase", response_model=schemas.DocumentReport)
def purchase_report(doc_type: str = "INVOICE",
                    date_from: Optional[date] = None,
                    date_to: Optional[date] = None,
                    db: Session = Depends(get_db)):
    return build_document_report(
        db, model=models.PurchaseDocument, line_model=models.PurchaseDocumentLine,
        party_attr="supplier", doc_type=doc_type,
        date_from=date_from, date_to=date_to, allowed_types=PURCHASE_TYPES)


@router.get("/stock", response_model=schemas.StockReport)
def stock_report(warehouse_id: Optional[int] = None,
                 product_id: Optional[int] = None,
                 include_zero: bool = False,
                 db: Session = Depends(get_db)):
    """Closing stock per product per warehouse, valued at opening cost.

    Reuses the same balance calculation the Inventory screens use, so the
    report and those screens can never disagree.
    """
    balances = read_balances(product_id=product_id, warehouse_id=warehouse_id,
                             include_zero=include_zero, db=db)

    # Value at the opening-stock cost for that product/warehouse where one
    # exists — the only cost the system records against physical stock.
    costs = {}
    for row in db.query(models.OpeningStock).filter(
            models.OpeningStock.is_active.is_(True)).all():
        key = (row.product_id, row.warehouse_id)
        existing = costs.setdefault(key, {"qty": 0.0, "value": 0.0})
        existing["qty"] += row.quantity or 0.0
        existing["value"] += (row.quantity or 0.0) * (row.unit_cost or 0.0)

    products = {p.id: p for p in db.query(models.Product).all()}

    rows, total_qty, total_value = [], 0.0, 0.0
    for balance in balances:
        product = products.get(balance.product_id)
        cost_bucket = costs.get((balance.product_id, balance.warehouse_id))
        avg_cost = (cost_bucket["value"] / cost_bucket["qty"]
                    if cost_bucket and cost_bucket["qty"] else 0.0)
        # Fall back to the product's list price when there is no opening lot.
        if not avg_cost and product:
            avg_cost = product.current_price or 0.0

        value = balance.on_hand * avg_cost
        total_qty += balance.on_hand
        total_value += value

        rows.append(schemas.StockReportRow(
            product_id=balance.product_id, ticker=balance.ticker,
            product_name=balance.product_name,
            unit=product.unit.abbreviation if product and product.unit else None,
            warehouse_id=balance.warehouse_id,
            warehouse_name=balance.warehouse_name,
            opening_qty=round(balance.opening_qty, 2),
            in_qty=round(balance.in_qty, 2),
            out_qty=round(balance.out_qty, 2),
            closing_qty=round(balance.on_hand, 2),
            avg_cost=round(avg_cost, 2), stock_value=round(value, 2),
        ))

    return schemas.StockReport(
        rows=rows, total_closing_qty=round(total_qty, 2),
        total_stock_value=round(total_value, 2),
    )


@router.get("/gst", response_model=schemas.GstReport)
def gst_report(date_from: Optional[date] = None,
               date_to: Optional[date] = None,
               sales_doc_type: str = "INVOICE",
               purchase_doc_type: str = "INVOICE",
               db: Session = Depends(get_db)):
    """Output tax charged on sales against input tax paid on purchases.

    The difference is what is payable to (or reclaimable from) the authority.
    """
    def collect(model, doc_type):
        query = db.query(model).filter(
            model.doc_type == doc_type.upper(),
            model.status != "CANCELLED",
        )
        if date_from:
            query = query.filter(model.doc_date >= date_from)
        if date_to:
            query = query.filter(model.doc_date <= date_to)

        buckets = {}
        for doc in query.all():
            for line in doc.lines:
                subtotal, tax = line_money(line)
                name = line.tax.name if line.tax else "No Tax"
                rate = line.tax.rate if line.tax else 0.0
                bucket = buckets.setdefault(
                    name, {"rate": rate, "taxable": 0.0, "tax": 0.0})
                bucket["taxable"] += subtotal
                bucket["tax"] += tax

        rows = [schemas.GstRateRow(
            tax_name=name, rate=b["rate"],
            taxable_value=round(b["taxable"], 2), tax_amount=round(b["tax"], 2),
        ) for name, b in buckets.items()]
        rows.sort(key=lambda r: -r.rate)
        return rows

    output_rows = collect(models.SalesDocument, sales_doc_type)
    input_rows = collect(models.PurchaseDocument, purchase_doc_type)

    output_taxable = sum(r.taxable_value for r in output_rows)
    output_tax = sum(r.tax_amount for r in output_rows)
    input_taxable = sum(r.taxable_value for r in input_rows)
    input_tax = sum(r.tax_amount for r in input_rows)

    return schemas.GstReport(
        date_from=date_from, date_to=date_to,
        output_rows=output_rows, input_rows=input_rows,
        output_taxable=round(output_taxable, 2), output_tax=round(output_tax, 2),
        input_taxable=round(input_taxable, 2), input_tax=round(input_tax, 2),
        net_payable=round(output_tax - input_tax, 2),
    )


@router.get("/dashboard", response_model=schemas.DashboardSummary)
def dashboard(db: Session = Depends(get_db)):
    """Everything the overview screen shows, in one call.

    Built from the same functions the individual report screens use, so the
    dashboard cannot quietly disagree with the pages it summarises.
    """
    # --- Revenue, from confirmed sales invoices ---
    sales = build_document_report(
        db, model=models.SalesDocument, line_model=models.SalesDocumentLine,
        party_attr="customer", doc_type="INVOICE", date_from=None, date_to=None,
        allowed_types=SALES_TYPES, status="CONFIRMED")

    by_month = [schemas.SeriesPoint(label=r.key, value=r.total) for r in sales.by_period]
    revenue = schemas.DashboardRevenue(
        total=sales.grand_total, subtotal=sales.subtotal, tax=sales.tax_total,
        invoice_count=sales.document_count,
        average_invoice=round(sales.grand_total / sales.document_count, 2)
        if sales.document_count else 0.0,
        best_month=max((p.value for p in by_month), default=0.0),
        by_month=by_month,
    )

    # --- Pipeline: how far orders have travelled ---
    def count_and_value(doc_type):
        report = build_document_report(
            db, model=models.SalesDocument, line_model=models.SalesDocumentLine,
            party_attr="customer", doc_type=doc_type, date_from=None, date_to=None,
            allowed_types=SALES_TYPES, status="CONFIRMED")
        return report.document_count, report.grand_total

    order_count, order_value = count_and_value("ORDER")
    delivery_count, _ = count_and_value("DELIVERY")
    pipeline = schemas.DashboardPipeline(
        orders=order_count, deliveries=delivery_count,
        invoices=sales.document_count,
        order_value=order_value, invoiced_value=sales.grand_total,
        conversion_pct=round(sales.document_count / order_count * 100, 1)
        if order_count else 0.0,
    )

    # --- Customers and what they owe ---
    receivables = accounting.read_party_balances(group="RECEIVABLE", as_of=None, db=db)
    all_customers = db.query(models.Customer).all()
    customers = schemas.DashboardCustomers(
        total=len(all_customers),
        active=len([c for c in all_customers if c.is_active]),
        with_balance=len([r for r in receivables if abs(r.balance) > 0.005]),
        total_receivable=round(sum(r.balance for r in receivables), 2),
        top=[schemas.NamedAmount(label=r.party_name, sublabel=r.party_type,
                                 amount=r.balance)
             for r in receivables[:4]],
    )

    # --- Payables ---
    payable_rows = accounting.read_party_balances(group="PAYABLE", as_of=None, db=db)
    payables = schemas.DashboardPayables(
        total_payable=round(sum(r.balance for r in payable_rows), 2),
        supplier_count=len([r for r in payable_rows if abs(r.balance) > 0.005]),
        top=[schemas.NamedAmount(label=r.party_name, sublabel=r.party_type,
                                 amount=r.balance)
             for r in payable_rows[:4]],
    )

    # --- Inventory, straight from the stock report ---
    stock = stock_report(warehouse_id=None, product_id=None, include_zero=False, db=db)
    by_location, by_product = {}, {}
    for row in stock.rows:
        by_location[row.warehouse_name] = by_location.get(row.warehouse_name, 0.0) + row.stock_value
        by_product[row.ticker] = by_product.get(row.ticker, 0.0) + row.stock_value

    inventory = schemas.DashboardInventory(
        product_count=db.query(models.Product).count(),
        total_quantity=stock.total_closing_qty,
        total_value=stock.total_stock_value,
        location_count=len(by_location),
        out_of_stock=len([r for r in stock.rows if r.closing_qty <= 0]),
        by_location=[schemas.SeriesPoint(label=k, value=round(v, 2))
                     for k, v in sorted(by_location.items(), key=lambda kv: -kv[1])],
        by_product=[schemas.SeriesPoint(label=k, value=round(v, 2))
                    for k, v in sorted(by_product.items(), key=lambda kv: -kv[1])[:6]],
    )

    # --- What needs attention ---
    trial = accounting.read_trial_balance(as_of=None, db=db)
    attention = schemas.DashboardAttention(
        draft_sales=db.query(models.SalesDocument).filter(
            models.SalesDocument.status == "DRAFT").count(),
        draft_purchases=db.query(models.PurchaseDocument).filter(
            models.PurchaseDocument.status == "DRAFT").count(),
        draft_journals=db.query(models.JournalEntry).filter(
            models.JournalEntry.status == "DRAFT").count(),
        out_of_stock=inventory.out_of_stock,
        unbalanced_books=not trial.is_balanced,
    )

    # --- Trading book ---
    from routers.trades import read_positions
    positions = read_positions(product_id=None, include_closed=False, db=db)
    trading = schemas.DashboardTrading(
        realized=positions.total_realized,
        unrealized=positions.total_unrealized,
        open_positions=len([p for p in positions.positions if p.quantity > 0]),
    )

    # --- Recent activity across the modules ---
    recent = []
    for doc in (db.query(models.SalesDocument)
                  .order_by(models.SalesDocument.doc_date.desc(),
                            models.SalesDocument.id.desc()).limit(5).all()):
        total = sum((l.quantity or 0) * (l.unit_price or 0) *
                    (1 - (l.discount_pct or 0) / 100) for l in doc.lines)
        recent.append(schemas.DashboardActivity(
            kind="SALES", reference=f"{doc.doc_type.title()} {doc.doc_no}",
            party=doc.customer.name if doc.customer else None,
            entry_date=doc.doc_date, amount=round(total, 2), status=doc.status))

    for doc in (db.query(models.PurchaseDocument)
                  .order_by(models.PurchaseDocument.doc_date.desc(),
                            models.PurchaseDocument.id.desc()).limit(5).all()):
        total = sum((l.quantity or 0) * (l.unit_price or 0) *
                    (1 - (l.discount_pct or 0) / 100) for l in doc.lines)
        recent.append(schemas.DashboardActivity(
            kind="PURCHASE", reference=f"{doc.doc_type.title()} {doc.doc_no}",
            party=doc.supplier.name if doc.supplier else None,
            entry_date=doc.doc_date, amount=round(total, 2), status=doc.status))

    recent.sort(key=lambda a: a.entry_date, reverse=True)

    return schemas.DashboardSummary(
        revenue=revenue, pipeline=pipeline, customers=customers,
        payables=payables, inventory=inventory, attention=attention,
        trading=trading, recent=recent[:6],
    )


@router.get("/outstanding", response_model=schemas.OutstandingReport)
def outstanding_report(as_of: Optional[date] = None, db: Session = Depends(get_db)):
    """Receivables and payables side by side, from the AR/AP control accounts."""
    receivables = accounting.read_party_balances(group="RECEIVABLE", as_of=as_of, db=db)
    payables = accounting.read_party_balances(group="PAYABLE", as_of=as_of, db=db)

    total_receivable = sum(r.balance for r in receivables)
    total_payable = sum(r.balance for r in payables)

    return schemas.OutstandingReport(
        receivables=receivables, payables=payables,
        total_receivable=round(total_receivable, 2),
        total_payable=round(total_payable, 2),
        net_position=round(total_receivable - total_payable, 2),
    )
