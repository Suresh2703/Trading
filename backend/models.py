from sqlalchemy import (Boolean, Column, ForeignKey, Integer, String, Float,
                        DateTime, Date, UniqueConstraint)
from sqlalchemy.orm import relationship
import datetime

from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True)
    email = Column(String(150), unique=True, index=True)
    hashed_password = Column(String(255))
    # ADMIN may manage other accounts; USER may not.
    role = Column(String(20), nullable=False, default="USER", index=True)
    is_active = Column(Boolean, default=True)

    accounts = relationship("Account", back_populates="owner")
    orders = relationship("Order", back_populates="owner")

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    currency = Column(String(10), index=True) # e.g., "USD", "BTC"
    balance = Column(Float, default=0.0)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="accounts")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)

    products = relationship("Product", back_populates="category")

class Unit(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True)
    abbreviation = Column(String(10), unique=True)
    is_active = Column(Boolean, default=True)

    products = relationship("Product", back_populates="unit")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(50), unique=True, index=True) # e.g., "AAPL"
    name = Column(String(255))
    description = Column(String(1024), nullable=True)
    current_price = Column(Float, default=0.0)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    
    category = relationship("Category", back_populates="products")
    unit = relationship("Unit", back_populates="products")
    orders = relationship("Order", back_populates="product")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    order_type = Column(String(10)) # "BUY" or "SELL"
    quantity = Column(Integer)
    price = Column(Float)
    status = Column(String(20), default="PENDING") # PENDING, EXECUTED, CANCELLED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="orders")
    product = relationship("Product", back_populates="orders")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    buy_order_id = Column(Integer, ForeignKey("orders.id"))
    sell_order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    price = Column(Float)
    executed_at = Column(DateTime, default=datetime.datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True)
    name = Column(String(255), index=True)
    email = Column(String(150), nullable=True)
    phone = Column(String(50), nullable=True)
    gstin = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True, default="India")
    credit_limit = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True)
    name = Column(String(255), index=True)
    email = Column(String(150), nullable=True)
    phone = Column(String(50), nullable=True)
    gstin = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True, default="India")
    payment_terms = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)

class Tax(Base):
    __tablename__ = "taxes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    tax_type = Column(String(20), default="GST")  # GST, CGST, SGST, IGST, VAT, CESS
    rate = Column(Float, default=0.0)             # percentage, e.g. 18.0
    hsn_code = Column(String(20), nullable=True)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)

class Warehouse(Base):
    """A physical place stock can sit.

    Replaces the free-text location that every stock and document screen used
    to carry: a typo like "Main Store " could otherwise create a phantom
    location holding real inventory.
    """
    __tablename__ = "warehouses"
    __table_args__ = (
        UniqueConstraint("code", name="uq_warehouse_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    contact_person = Column(String(150), nullable=True)
    phone = Column(String(50), nullable=True)
    # Exactly one warehouse should be the default the forms preselect.
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

class OpeningStock(Base):
    """The stock a product already had when the books were opened.

    One row per product per location per batch — that combination is unique so
    the same opening balance cannot be entered twice. `quantity * unit_cost` is
    derived on read rather than stored, so the value can never drift.
    """
    __tablename__ = "opening_stock"
    __table_args__ = (
        UniqueConstraint("product_id", "warehouse_id", "batch_no",
                         name="uq_opening_stock_product_warehouse_batch"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"),
                          nullable=False, index=True)
    # Empty string rather than NULL so the unique constraint actually applies
    # (MySQL treats NULLs as distinct, which would allow duplicate rows).
    batch_no = Column(String(50), nullable=False, default="")
    quantity = Column(Float, nullable=False, default=0.0)
    unit_cost = Column(Float, nullable=False, default=0.0)
    as_of_date = Column(Date, nullable=False, default=datetime.date.today)
    remarks = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)

    product = relationship("Product")
    warehouse = relationship("Warehouse")

class StockMovement(Base):
    """Every stock movement — in, out, transfer and adjustment — in one table.

    The four screens are views over this table filtered by `movement_type`.
    Direction is expressed purely by which location column is set, so a single
    rule computes any balance:

        on hand at L = opening stock at L
                     + SUM(quantity) where to_location   = L
                     - SUM(quantity) where from_location = L

    That makes a transfer just a row with both columns set, and an adjustment a
    row with exactly one — no per-type special-casing in the balance query.
    `quantity` is therefore always a positive magnitude.
    """
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    movement_type = Column(String(20), nullable=False, index=True)  # IN/OUT/TRANSFER/ADJUSTMENT
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False, default=0.0)
    unit_cost = Column(Float, nullable=False, default=0.0)
    from_warehouse_id = Column(Integer, ForeignKey("warehouses.id"),
                               nullable=True, index=True)
    to_warehouse_id = Column(Integer, ForeignKey("warehouses.id"),
                             nullable=True, index=True)
    reference_no = Column(String(50), nullable=True)
    movement_date = Column(Date, nullable=False, default=datetime.date.today)
    # Counterparty: supplier on a stock-in, customer on a stock-out.
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    reason = Column(String(100), nullable=True)   # adjustments: damage, count correction...
    remarks = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    # Set when a movement was auto-posted from a sales document (delivery or
    # return) rather than entered by hand. Lets the document own its movements:
    # re-saving regenerates them, deleting removes them.
    source_document_id = Column(Integer, ForeignKey("sales_documents.id"),
                                nullable=True, index=True)
    source_purchase_id = Column(Integer, ForeignKey("purchase_documents.id"),
                                nullable=True, index=True)
    source_line_id = Column(Integer, nullable=True)

    product = relationship("Product")
    supplier = relationship("Supplier")
    customer = relationship("Customer")
    from_warehouse = relationship("Warehouse", foreign_keys=[from_warehouse_id])
    to_warehouse = relationship("Warehouse", foreign_keys=[to_warehouse_id])

class SalesDocument(Base):
    """Every sales document — order, delivery, invoice, return, credit note.

    One table with a `doc_type` discriminator, the same shape as StockMovement.
    `parent_id` chains the flow (order -> delivery -> invoice -> return -> credit
    note) so a document can be traced back to what it came from.

    Money is deliberately NOT stored on the header: subtotal, tax and grand
    total are derived from the lines on read, so a header can never disagree
    with the lines beneath it.
    """
    __tablename__ = "sales_documents"
    __table_args__ = (
        UniqueConstraint("doc_type", "doc_no", name="uq_sales_document_type_no"),
    )

    id = Column(Integer, primary_key=True, index=True)
    doc_type = Column(String(20), nullable=False, index=True)
    doc_no = Column(String(50), nullable=False, index=True)
    doc_date = Column(Date, nullable=False, default=datetime.date.today)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("sales_documents.id"), nullable=True)
    # Which warehouse ships or receives — required for the types that move stock.
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    reference_no = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT/CONFIRMED/CANCELLED
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer")
    warehouse = relationship("Warehouse")
    parent = relationship("SalesDocument", remote_side=[id])
    lines = relationship("SalesDocumentLine", back_populates="document",
                         cascade="all, delete-orphan", order_by="SalesDocumentLine.id")

class SalesDocumentLine(Base):
    __tablename__ = "sales_document_lines"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("sales_documents.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    discount_pct = Column(Float, nullable=False, default=0.0)
    tax_id = Column(Integer, ForeignKey("taxes.id"), nullable=True)
    remarks = Column(String(255), nullable=True)

    document = relationship("SalesDocument", back_populates="lines")
    product = relationship("Product")
    tax = relationship("Tax")

class PurchaseDocument(Base):
    """The buy-side mirror of SalesDocument.

    Same shape, same rules — the counterparty is a supplier rather than a
    customer, and the stock effects are reversed: a goods receipt brings stock
    in, a purchase return sends it back out.
    """
    __tablename__ = "purchase_documents"
    __table_args__ = (
        UniqueConstraint("doc_type", "doc_no", name="uq_purchase_document_type_no"),
    )

    id = Column(Integer, primary_key=True, index=True)
    doc_type = Column(String(20), nullable=False, index=True)
    doc_no = Column(String(50), nullable=False, index=True)
    doc_date = Column(Date, nullable=False, default=datetime.date.today)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("purchase_documents.id"), nullable=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    reference_no = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT")
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    supplier = relationship("Supplier")
    warehouse = relationship("Warehouse")
    parent = relationship("PurchaseDocument", remote_side=[id])
    lines = relationship("PurchaseDocumentLine", back_populates="document",
                         cascade="all, delete-orphan",
                         order_by="PurchaseDocumentLine.id")

class PurchaseDocumentLine(Base):
    __tablename__ = "purchase_document_lines"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("purchase_documents.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    discount_pct = Column(Float, nullable=False, default=0.0)
    tax_id = Column(Integer, ForeignKey("taxes.id"), nullable=True)
    remarks = Column(String(255), nullable=True)

    document = relationship("PurchaseDocument", back_populates="lines")
    product = relationship("Product")
    tax = relationship("Tax")

class Trade(Base):
    """A single buy or sell in the trading book.

    This is a dealing book, deliberately separate from warehouse stock: a trade
    changes the position and the cost basis but posts no stock movement, so the
    same units are never counted both here and in Inventory.

    Cost basis is FIFO, computed on read by walking trades in date order rather
    than stored. Storing a running basis would go stale the moment a back-dated
    trade was inserted or an old one edited.
    """
    __tablename__ = "trades"
    __table_args__ = (
        UniqueConstraint("trade_no", name="uq_trade_no"),
    )

    id = Column(Integer, primary_key=True, index=True)
    trade_no = Column(String(50), nullable=False, index=True)
    side = Column(String(4), nullable=False, index=True)          # BUY | SELL
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Float, nullable=False, default=0.0)
    price = Column(Float, nullable=False, default=0.0)            # per unit
    # Brokerage and charges: added to cost on a buy, netted off proceeds on a sell.
    fees = Column(Float, nullable=False, default=0.0)
    trade_date = Column(Date, nullable=False, default=datetime.date.today, index=True)
    counterparty = Column(String(150), nullable=True)
    reference_no = Column(String(50), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product")

class ChartOfAccount(Base):
    """One line of the chart of accounts.

    `account_type` drives the reports — assets, liabilities and equity go to the
    balance sheet; income and expenses to the P&L. `account_group` is the finer
    classification the ledger screens filter on: CASH, BANK, RECEIVABLE, PAYABLE
    and TAX are treated specially, the rest are presentational.
    """
    __tablename__ = "chart_of_accounts"
    __table_args__ = (
        UniqueConstraint("code", name="uq_chart_of_account_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    account_type = Column(String(20), nullable=False, index=True)
    account_group = Column(String(30), nullable=False, default="OTHER", index=True)
    parent_id = Column(Integer, ForeignKey("chart_of_accounts.id"), nullable=True)
    # Balance carried in when the books opened, stated on its natural side.
    opening_balance = Column(Float, nullable=False, default=0.0)
    opening_is_debit = Column(Boolean, nullable=False, default=True)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)

    parent = relationship("ChartOfAccount", remote_side=[id])

class JournalEntry(Base):
    """A double-entry voucher: a header plus lines that must balance.

    Payments, receipts and expenses are all journal entries with a different
    `entry_type`, so one posting engine and one ledger serve every screen.
    """
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("entry_no", name="uq_journal_entry_no"),
    )

    id = Column(Integer, primary_key=True, index=True)
    entry_no = Column(String(50), nullable=False, index=True)
    entry_type = Column(String(20), nullable=False, default="JOURNAL", index=True)
    entry_date = Column(Date, nullable=False, default=datetime.date.today, index=True)
    narration = Column(String(500), nullable=True)
    reference_no = Column(String(50), nullable=True)
    # Optional counterparty, so receivables and payables can be split by party.
    party_type = Column(String(20), nullable=True)     # CUSTOMER | SUPPLIER
    party_id = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="POSTED")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    lines = relationship("JournalLine", back_populates="entry",
                         cascade="all, delete-orphan", order_by="JournalLine.id")

class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"),
                      nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("chart_of_accounts.id"),
                        nullable=False, index=True)
    # A line carries a value on exactly one side; the other stays zero.
    debit = Column(Float, nullable=False, default=0.0)
    credit = Column(Float, nullable=False, default=0.0)
    line_narration = Column(String(255), nullable=True)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccount")


class UserPreference(Base):
    """A per-user UI setting, stored against the account rather than the browser.

    Key/value rather than one JSON blob so two settings saved at once cannot
    overwrite each other, and so a new preference needs no migration.
    """
    __tablename__ = "user_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "pref_key", name="uq_user_preference"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    pref_key = Column(String(60), nullable=False)
    pref_value = Column(String(500), nullable=True)

    user = relationship("User")

class Role(Base):
    """A named set of permissions.

    `code` is the natural key stored on users, so it is fixed once created —
    renaming it would silently orphan every account carrying it.
    """
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("code", name="uq_role_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), nullable=False, index=True)
    name = Column(String(80), nullable=False)
    description = Column(String(300), nullable=True)
    # System roles cannot be deleted: ADMIN is the way back in if the matrix
    # is misconfigured.
    is_system = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    permissions = relationship("RolePermission", back_populates="role",
                               cascade="all, delete-orphan")

class RolePermission(Base):
    """What one role may do with one module.

    Absent row means no access, so a new module is closed until granted rather
    than open by default.
    """
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "module", name="uq_role_permission"),
    )

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    module = Column(String(40), nullable=False, index=True)
    # Reading the screen, and changing anything on it.
    can_view = Column(Boolean, nullable=False, default=False)
    can_edit = Column(Boolean, nullable=False, default=False)

    role = relationship("Role", back_populates="permissions")


class PosSale(Base):
    """One counter sale, tying together the documents a checkout produces.

    A POS sale is deliberately not a new kind of sales document. Ringing one up
    raises the same delivery and invoice a manual counter sale would, so it
    reaches the sales reports, the GST return and the dashboard without any of
    them needing to know POS exists — and stock leaves through the one path
    that already knows how to reverse itself.

    What is left is what only a till knows: how it was paid, what was handed
    over, who rang it up. That is this table.
    """
    __tablename__ = "pos_sales"
    __table_args__ = (
        UniqueConstraint("receipt_no", name="uq_pos_sale_receipt_no"),
    )

    id = Column(Integer, primary_key=True, index=True)
    receipt_no = Column(String(50), nullable=False, index=True)
    sale_date = Column(Date, nullable=False, default=datetime.date.today, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False, index=True)

    # The documents this checkout raised. Nullable so a void can clear the
    # receipt posting without losing the sale record.
    delivery_id = Column(Integer, ForeignKey("sales_documents.id"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("sales_documents.id"), nullable=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)

    payment_method = Column(String(20), nullable=False, default="CASH", index=True)
    amount_total = Column(Float, nullable=False, default=0.0)
    # Only meaningful for cash: what the customer handed over, and what went back.
    amount_tendered = Column(Float, nullable=False, default=0.0)
    change_given = Column(Float, nullable=False, default=0.0)

    # How a card or UPI payment can be traced back to a statement, without ever
    # holding anything that could be used to charge the card again. Four digits
    # and an issuer are enough to reconcile; the column is deliberately four
    # characters wide so a full card number cannot fit in it even by mistake.
    payment_bank = Column(String(100), nullable=True)
    payment_last4 = Column(String(4), nullable=True)
    payment_reference = Column(String(60), nullable=True)

    # Who the sale is billed to, captured when it goes on account. Snapshotted
    # rather than read back from the customer, so editing an address later
    # cannot rewrite what an already-printed receipt said.
    bill_to_name = Column(String(255), nullable=True)
    bill_to_address = Column(String(500), nullable=True)

    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="COMPLETED", index=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer")
    warehouse = relationship("Warehouse")
    cashier = relationship("User")
    delivery = relationship("SalesDocument", foreign_keys=[delivery_id])
    invoice = relationship("SalesDocument", foreign_keys=[invoice_id])
    journal_entry = relationship("JournalEntry")
