from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional
from datetime import date

import crud, models, schemas
from database import get_db

router = APIRouter(
    prefix="/trades",
    tags=["trades"],
)

BUY, SELL = "BUY", "SELL"
SIDES = {BUY, SELL}

# Float quantities never land exactly on zero, so lots are closed within this.
EPSILON = 1e-9


# --- FIFO engine -----------------------------------------------------------

def ordered_trades(db: Session, product_id: Optional[int] = None,
                   exclude_id: Optional[int] = None,
                   extra: Optional[dict] = None) -> List[dict]:
    """All trades as plain dicts, in the order they must be consumed.

    Chronological by trade date, then by id so same-day trades keep their entry
    order. `exclude`/`extra` let a proposed create or edit be evaluated against
    the timeline before it is written.
    """
    query = db.query(models.Trade)
    if product_id is not None:
        query = query.filter(models.Trade.product_id == product_id)
    if exclude_id is not None:
        query = query.filter(models.Trade.id != exclude_id)

    rows = [{
        "id": t.id, "trade_no": t.trade_no, "side": t.side,
        "product_id": t.product_id, "quantity": t.quantity, "price": t.price,
        "fees": t.fees, "trade_date": t.trade_date,
    } for t in query.all()]

    if extra:
        rows.append(extra)

    # id may be None for a not-yet-saved trade; sort it last within its date.
    rows.sort(key=lambda r: (r["trade_date"], r["id"] if r["id"] is not None else 10**9))
    return rows


def run_fifo(trades: List[dict]):
    """Walk one product's trades, matching sells against the oldest buys.

    Returns (open_lots, realized_by_trade_id, shortfall). `shortfall` is any
    quantity sold that no buy lot could cover — validation should prevent it,
    but the engine reports rather than hides it.
    """
    lots = []            # oldest first: {qty, unit_cost, trade_id, trade_no, date}
    realized = {}        # sell trade id -> {"pnl", "cost"}
    shortfall = 0.0

    for t in trades:
        qty = t["quantity"] or 0.0
        fees = t["fees"] or 0.0

        if t["side"] == BUY:
            # Buying costs the price plus its share of the fees.
            unit_cost = (t["price"] or 0.0) + (fees / qty if qty else 0.0)
            lots.append({
                "qty": qty, "unit_cost": unit_cost, "trade_id": t["id"],
                "trade_no": t["trade_no"], "date": t["trade_date"],
            })
            continue

        remaining = qty
        cost = 0.0
        while remaining > EPSILON and lots:
            lot = lots[0]
            take = min(remaining, lot["qty"])
            cost += take * lot["unit_cost"]
            lot["qty"] -= take
            remaining -= take
            if lot["qty"] <= EPSILON:
                lots.pop(0)

        if remaining > EPSILON:
            shortfall += remaining

        proceeds = qty * (t["price"] or 0.0) - fees
        realized[t["id"]] = {"pnl": round(proceeds - cost, 2), "cost": round(cost, 2)}

    return lots, realized, shortfall


def position_never_negative(trades: List[dict]) -> Optional[dict]:
    """Return the first trade that would drive the position below zero.

    Checked over the whole timeline rather than just the end, so a back-dated
    sell cannot be slipped in before the buy that covers it.
    """
    running = 0.0
    for t in trades:
        qty = t["quantity"] or 0.0
        running += qty if t["side"] == BUY else -qty
        if running < -EPSILON:
            return {"trade": t, "shortfall": -running}
    return None


# --- Validation ------------------------------------------------------------

def validate(db: Session, data: dict, exclude_id: Optional[int] = None):
    side = (data.get("side") or "").upper()
    if side not in SIDES:
        raise HTTPException(status_code=400, detail="side must be BUY or SELL")

    if not (data.get("trade_no") or "").strip():
        raise HTTPException(status_code=400, detail="Trade number is required")

    product = crud.get_one(db, models.Product, data.get("product_id"))
    if product is None:
        raise HTTPException(status_code=400, detail="Selected product does not exist")

    if (data.get("quantity") or 0) <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
    if (data.get("price") or 0) < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")
    if (data.get("fees") or 0) < 0:
        raise HTTPException(status_code=400, detail="Fees cannot be negative")

    proposed = {
        "id": exclude_id, "trade_no": data.get("trade_no"), "side": side,
        "product_id": data["product_id"], "quantity": data.get("quantity") or 0.0,
        "price": data.get("price") or 0.0, "fees": data.get("fees") or 0.0,
        "trade_date": data["trade_date"],
    }
    timeline = ordered_trades(db, data["product_id"], exclude_id=exclude_id, extra=proposed)

    breach = position_never_negative(timeline)
    if breach:
        offender = breach["trade"]
        raise HTTPException(
            status_code=400,
            detail=(f"This would sell more {product.ticker} than is held. "
                    f"On {offender['trade_date']} the position would go short by "
                    f"{breach['shortfall']:g}. Record the matching buy first.")
        )


# --- Endpoints -------------------------------------------------------------

@router.get("/", response_model=List[schemas.Trade])
def read_trades(skip: int = 0, limit: int = 500,
                side: Optional[str] = None,
                product_id: Optional[int] = None,
                date_from: Optional[date] = None,
                date_to: Optional[date] = None,
                db: Session = Depends(get_db)):
    query = db.query(models.Trade)
    if side:
        query = query.filter(models.Trade.side == side.upper())
    if product_id is not None:
        query = query.filter(models.Trade.product_id == product_id)
    if date_from:
        query = query.filter(models.Trade.trade_date >= date_from)
    if date_to:
        query = query.filter(models.Trade.trade_date <= date_to)

    rows = (query.order_by(models.Trade.trade_date.desc(), models.Trade.id.desc())
                 .offset(skip).limit(limit).all())

    # Realized profit is a property of the whole timeline, not of one row, so
    # the FIFO pass runs per product and its results are attached to the sells.
    realized_all = {}
    for pid in {r.product_id for r in rows}:
        _, realized, _ = run_fifo(ordered_trades(db, pid))
        realized_all.update(realized)

    out = []
    for row in rows:
        trade = schemas.Trade.model_validate(row)
        if row.side == SELL and row.id in realized_all:
            trade.realized_pnl = realized_all[row.id]["pnl"]
            trade.cost_of_sale = realized_all[row.id]["cost"]
        out.append(trade)
    return out


@router.get("/positions", response_model=schemas.ProfitSummary)
def read_positions(product_id: Optional[int] = None,
                   include_closed: bool = False,
                   db: Session = Depends(get_db)):
    """Open position, cost basis and profit per product.

    Unrealized profit marks the remaining lots against the product's
    `current_price` from the product master.
    """
    product_ids = ([product_id] if product_id is not None
                   else [r[0] for r in db.query(models.Trade.product_id).distinct().all()])

    positions = []
    total_realized = total_unrealized = 0.0
    total_cost = total_market = total_fees = 0.0

    for pid in product_ids:
        product = crud.get_one(db, models.Product, pid)
        if product is None:
            continue

        timeline = ordered_trades(db, pid)
        lots, realized, _ = run_fifo(timeline)

        qty = sum(lot["qty"] for lot in lots)
        cost_value = sum(lot["qty"] * lot["unit_cost"] for lot in lots)
        realized_pnl = sum(r["pnl"] for r in realized.values())
        fees = sum(t["fees"] or 0.0 for t in timeline)

        market_price = product.current_price or 0.0
        market_value = qty * market_price

        total_realized += realized_pnl
        total_unrealized += market_value - cost_value
        total_cost += cost_value
        total_market += market_value
        total_fees += fees

        if qty <= EPSILON and not include_closed and abs(realized_pnl) < 0.005:
            continue

        positions.append(schemas.Position(
            product_id=pid,
            ticker=product.ticker,
            product_name=product.name,
            quantity=round(qty, 4),
            average_cost=round(cost_value / qty, 4) if qty > EPSILON else 0.0,
            cost_value=round(cost_value, 2),
            market_price=round(market_price, 2),
            market_value=round(market_value, 2),
            unrealized_pnl=round(market_value - cost_value, 2),
            realized_pnl=round(realized_pnl, 2),
            open_lots=[schemas.OpenLot(
                buy_trade_id=lot["trade_id"], trade_no=lot["trade_no"],
                trade_date=lot["date"], quantity=round(lot["qty"], 4),
                unit_cost=round(lot["unit_cost"], 4),
            ) for lot in lots],
        ))

    positions.sort(key=lambda p: p.ticker)
    return schemas.ProfitSummary(
        positions=positions,
        total_realized=round(total_realized, 2),
        total_unrealized=round(total_unrealized, 2),
        total_cost_value=round(total_cost, 2),
        total_market_value=round(total_market, 2),
        total_fees=round(total_fees, 2),
    )


@router.get("/{trade_id}", response_model=schemas.Trade)
def read_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = crud.get_one(db, models.Trade, trade_id)
    if trade is None:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade


@router.post("/", response_model=schemas.Trade, status_code=201)
def create_trade(payload: schemas.TradeCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["side"] = (data.get("side") or "").upper()
    validate(db, data)
    try:
        return crud.create_one(db, models.Trade, schemas.TradeCreate(**data))
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Trade '{payload.trade_no}' already exists"
        )


@router.put("/{trade_id}", response_model=schemas.Trade)
def update_trade(trade_id: int, payload: schemas.TradeUpdate,
                 db: Session = Depends(get_db)):
    existing = crud.get_one(db, models.Trade, trade_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Trade not found")

    data = {
        "trade_no": existing.trade_no, "side": existing.side,
        "product_id": existing.product_id, "quantity": existing.quantity,
        "price": existing.price, "fees": existing.fees,
        "trade_date": existing.trade_date,
    }
    data.update(payload.model_dump(exclude_unset=True))
    data["side"] = (data.get("side") or "").upper()
    validate(db, data, exclude_id=trade_id)

    try:
        trade = crud.update_one(db, models.Trade, trade_id, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="That trade number is already used")
    return trade


@router.delete("/{trade_id}")
def delete_trade(trade_id: int, db: Session = Depends(get_db)):
    existing = crud.get_one(db, models.Trade, trade_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Trade not found")

    # Removing a buy can leave a later sell uncovered, so check the timeline
    # as it would look without this trade.
    if existing.side == BUY:
        timeline = ordered_trades(db, existing.product_id, exclude_id=trade_id)
        breach = position_never_negative(timeline)
        if breach:
            raise HTTPException(
                status_code=409,
                detail=(f"Cannot delete this buy — later sells depend on it. "
                        f"The position would go short by {breach['shortfall']:g} "
                        f"on {breach['trade']['trade_date']}.")
            )

    try:
        crud.delete_one(db, models.Trade, trade_id)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not delete trade: {exc.__class__.__name__}"
        )
    return {"ok": True, "deleted_id": trade_id}
