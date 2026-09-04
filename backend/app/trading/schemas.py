from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TradingOrderBase(BaseModel):
    user_id: int
    product_id: int
    side: str
    quantity: int
    price: float

class TradingOrderCreate(TradingOrderBase):
    pass

class TradingOrder(TradingOrderBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class TradingTransactionBase(BaseModel):
    buy_order_id: int
    sell_order_id: int
    product_id: int
    executed_quantity: int
    execution_price: float

class TradingTransaction(TradingTransactionBase):
    id: int
    executed_at: datetime

    class Config:
        from_attributes = True
