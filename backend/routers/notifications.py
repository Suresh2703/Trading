"""Alerts, computed from the books rather than stored.

Nothing here is a saved notification record. Each alert is worked out from the
live data every time it is asked for, so an alert cannot linger after the thing
it was warning about has been dealt with — a restocked product simply stops
being low, without anything having to remember to clear a flag.

Which alerts run, and at what thresholds, come from the notification settings.
"""
import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

import models, schemas, settings_registry as reg
from database import get_db
from deps import get_current_user
from routers.settings import section_values

router = APIRouter(prefix="/notifications", tags=["notifications"])


def stock_on_hand(db: Session):
    """Closing quantity per product per warehouse, opening plus movements.

    Grouped in SQL rather than walked in Python: this runs on every page load
    that shows the bell.
    """
    balances = {}

    opening = db.query(
        models.OpeningStock.product_id,
        models.OpeningStock.warehouse_id,
        func.coalesce(func.sum(models.OpeningStock.quantity), 0.0),
    ).filter(models.OpeningStock.is_active.is_(True)).group_by(
        models.OpeningStock.product_id, models.OpeningStock.warehouse_id).all()
    for product_id, warehouse_id, qty in opening:
        balances[(product_id, warehouse_id)] = float(qty or 0)

    incoming = db.query(
        models.StockMovement.product_id,
        models.StockMovement.to_warehouse_id,
        func.coalesce(func.sum(models.StockMovement.quantity), 0.0),
    ).filter(models.StockMovement.to_warehouse_id.isnot(None)).group_by(
        models.StockMovement.product_id, models.StockMovement.to_warehouse_id).all()
    for product_id, warehouse_id, qty in incoming:
        key = (product_id, warehouse_id)
        balances[key] = balances.get(key, 0.0) + float(qty or 0)

    outgoing = db.query(
        models.StockMovement.product_id,
        models.StockMovement.from_warehouse_id,
        func.coalesce(func.sum(models.StockMovement.quantity), 0.0),
    ).filter(models.StockMovement.from_warehouse_id.isnot(None)).group_by(
        models.StockMovement.product_id, models.StockMovement.from_warehouse_id).all()
    for product_id, warehouse_id, qty in outgoing:
        key = (product_id, warehouse_id)
        balances[key] = balances.get(key, 0.0) - float(qty or 0)

    return balances


def alert(level, category, title, detail, link=None):
    return schemas.Notification(level=level, category=category, title=title,
                                detail=detail, link=link)


@router.get("/", response_model=schemas.NotificationFeed)
def read_notifications(db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    settings = section_values(db, reg.NOTIFICATIONS)
    items: List[schemas.Notification] = []

    needs_stock = settings["low_stock_enabled"] or settings["negative_stock_enabled"]
    if needs_stock:
        balances = stock_on_hand(db)
        products = {p.id: p for p in db.query(models.Product).all()}
        warehouses = {w.id: w for w in db.query(models.Warehouse).all()}
        threshold = settings["low_stock_threshold"]

        for (product_id, warehouse_id), qty in sorted(balances.items()):
            product = products.get(product_id)
            warehouse = warehouses.get(warehouse_id)
            if product is None or warehouse is None:
                continue
            where = f"{product.ticker or product.name} at {warehouse.name}"

            # Negative stock is a bookkeeping fault, not a purchasing signal,
            # so it is reported separately and more loudly.
            if qty < 0 and settings["negative_stock_enabled"]:
                items.append(alert(
                    "danger", "stock", "Negative stock",
                    f"{where} shows {qty:g} on hand, which cannot be right.",
                    "/reports/stock"))
            elif 0 <= qty <= threshold and settings["low_stock_enabled"]:
                items.append(alert(
                    "warning", "stock", "Low stock",
                    f"{where} is down to {qty:g}.", "/reports/stock"))

    if settings["overdue_enabled"]:
        cutoff = datetime.date.today() - datetime.timedelta(
            days=settings["overdue_days"])
        overdue = db.query(models.SalesDocument).filter(
            models.SalesDocument.doc_type == "INVOICE",
            models.SalesDocument.status == "CONFIRMED",
            models.SalesDocument.doc_date <= cutoff,
        ).order_by(models.SalesDocument.doc_date).all()
        for doc in overdue:
            party = doc.customer.name if doc.customer else "a customer"
            age = (datetime.date.today() - doc.doc_date).days
            items.append(alert(
                "warning", "receivable", "Invoice overdue",
                f"{doc.doc_no} to {party} is {age} days old.",
                "/reports/outstanding"))

    if settings["draft_docs_enabled"]:
        sales_drafts = db.query(func.count(models.SalesDocument.id)).filter(
            models.SalesDocument.status == "DRAFT").scalar() or 0
        purchase_drafts = db.query(func.count(models.PurchaseDocument.id)).filter(
            models.PurchaseDocument.status == "DRAFT").scalar() or 0

        if sales_drafts:
            items.append(alert(
                "info", "documents", "Sales documents in draft",
                f"{sales_drafts} document(s) are not confirmed, so they count "
                "towards nothing yet.", "/sales/invoice"))
        if purchase_drafts:
            items.append(alert(
                "info", "documents", "Purchase documents in draft",
                f"{purchase_drafts} document(s) are not confirmed.",
                "/purchases/invoice"))

    order = {"danger": 0, "warning": 1, "info": 2}
    items.sort(key=lambda i: order.get(i.level, 3))

    return schemas.NotificationFeed(
        count=len(items),
        danger=sum(1 for i in items if i.level == "danger"),
        warning=sum(1 for i in items if i.level == "warning"),
        info=sum(1 for i in items if i.level == "info"),
        items=items,
    )
