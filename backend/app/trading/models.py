from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
import datetime
from database import Base

class TradingOrder(Base):
    __tablename__ = "trading_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True) 
    product_id = Column(Integer, index=True) 
    side = Column(String(10)) # "BUY" or "SELL"
    quantity = Column(Integer)
    price = Column(Float)
    status = Column(String(20), default="PENDING") 
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TradingTransaction(Base):
    __tablename__ = "trading_transactions"

    id = Column(Integer, primary_key=True, index=True)
    buy_order_id = Column(Integer, ForeignKey("trading_orders.id"))
    sell_order_id = Column(Integer, ForeignKey("trading_orders.id"))
    product_id = Column(Integer)
    executed_quantity = Column(Integer)
    execution_price = Column(Float)
    executed_at = Column(DateTime, default=datetime.datetime.utcnow)
