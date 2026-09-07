from pydantic import BaseModel, computed_field
from typing import Any, Dict, List, Optional
from datetime import datetime, date

# --- Category ---
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class Category(CategoryBase):
    id: int

    class Config:
        from_attributes = True

# --- Unit ---
class UnitBase(BaseModel):
    name: str
    abbreviation: str
    is_active: bool = True

class UnitCreate(UnitBase):
    pass

class UnitUpdate(BaseModel):
    name: Optional[str] = None
    abbreviation: Optional[str] = None
    is_active: Optional[bool] = None

class Unit(UnitBase):
    id: int

    class Config:
        from_attributes = True

# --- Customer ---
class CustomerBase(BaseModel):
    code: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    credit_limit: float = 0.0
    is_active: bool = True

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    credit_limit: Optional[float] = None
    is_active: Optional[bool] = None

class Customer(CustomerBase):
    id: int

    class Config:
        from_attributes = True

# --- Supplier ---
class SupplierBase(BaseModel):
    code: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    payment_terms: Optional[str] = None
    is_active: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    payment_terms: Optional[str] = None
    is_active: Optional[bool] = None

class Supplier(SupplierBase):
    id: int

    class Config:
        from_attributes = True

# --- Tax ---
class TaxBase(BaseModel):
    name: str
    tax_type: str = "GST"
    rate: float = 0.0
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class TaxCreate(TaxBase):
    pass

class TaxUpdate(BaseModel):
    name: Optional[str] = None
    tax_type: Optional[str] = None
    rate: Optional[float] = None
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class Tax(TaxBase):
    id: int

    class Config:
        from_attributes = True

# --- Product ---
class ProductBase(BaseModel):
    ticker: str
    name: str
    description: Optional[str] = None
    current_price: float
    category_id: Optional[int] = None
    unit_id: Optional[int] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    ticker: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    current_price: Optional[float] = None
    category_id: Optional[int] = None
    unit_id: Optional[int] = None

class Product(ProductBase):
    id: int
    category: Optional[Category] = None
    unit: Optional[Unit] = None

    class Config:
        from_attributes = True

# --- Account ---
class AccountBase(BaseModel):
    currency: str
    balance: float = 0.0

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True

# --- User ---
class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str
    # Honoured only for an administrator; anyone else gets USER regardless.
    role: str = "USER"

class UserRoleUpdate(BaseModel):
    role: str

class User(UserBase):
    id: int
    role: str = "USER"
    is_active: bool
    accounts: List[Account] = []

    class Config:
        from_attributes = True

# --- Roles and permissions ---
class ModuleInfo(BaseModel):
    code: str
    label: str

class PermissionEntry(BaseModel):
    module: str
    can_view: bool = False
    can_edit: bool = False

    # Read directly off the ORM rows when a Role is validated from the model.
    class Config:
        from_attributes = True

class RoleBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool = True

class RoleCreate(RoleBase):
    permissions: List[PermissionEntry] = []

class RoleUpdate(BaseModel):
    # `code` is deliberately absent: it is the key stored on users, so renaming
    # it would orphan every account carrying it.
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[List[PermissionEntry]] = None

class Role(RoleBase):
    id: int
    is_system: bool = False
    permissions: List[PermissionEntry] = []
    user_count: int = 0

    class Config:
        from_attributes = True

class MyPermissions(BaseModel):
    """What the signed-in user may reach - this drives the menu."""
    role: str
    role_name: Optional[str] = None
    modules: dict = {}

# --- Passwords ---
class ChangePasswordRequest(BaseModel):
    """Changing your own password: proving you know the current one."""
    current_password: str
    new_password: str

class ResetPasswordRequest(BaseModel):
    """An administrator setting someone else's password."""
    new_password: str

# --- User preferences ---
class UserPreferences(BaseModel):
    """All of one user's settings, as a flat map of strings."""
    preferences: dict = {}

# --- Order ---
class OrderBase(BaseModel):
    product_id: int
    order_type: str
    quantity: int
    price: float

class OrderCreate(OrderBase):
    pass

class Order(OrderBase):
    id: int
    owner_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Transaction ---
class TransactionBase(BaseModel):
    buy_order_id: int
    sell_order_id: int
    product_id: int
    quantity: int
    price: float

class Transaction(TransactionBase):
    id: int
    executed_at: datetime

    class Config:
        from_attributes = True

# --- Warehouse ---
class WarehouseBase(BaseModel):
    code: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_default: bool = False
    is_active: bool = True

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None

class Warehouse(WarehouseBase):
    id: int

    class Config:
        from_attributes = True

# --- Opening Stock ---
class OpeningStockBase(BaseModel):
    product_id: int
    warehouse_id: int
    batch_no: str = ""
    quantity: float = 0.0
    unit_cost: float = 0.0
    as_of_date: date
    remarks: Optional[str] = None
    is_active: bool = True

class OpeningStockCreate(OpeningStockBase):
    pass

class OpeningStockUpdate(BaseModel):
    product_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    batch_no: Optional[str] = None
    quantity: Optional[float] = None
    unit_cost: Optional[float] = None
    as_of_date: Optional[date] = None
    remarks: Optional[str] = None
    is_active: Optional[bool] = None

class OpeningStock(OpeningStockBase):
    id: int
    product: Optional[Product] = None
    warehouse: Optional[Warehouse] = None

    @computed_field
    @property
    def total_value(self) -> float:
        """Derived on read so the stored quantity and cost can never disagree."""
        return round((self.quantity or 0.0) * (self.unit_cost or 0.0), 2)

    class Config:
        from_attributes = True

# --- Stock Movements (Stock In / Out / Transfer / Adjustment) ---
class StockMovementBase(BaseModel):
    movement_type: str
    product_id: int
    quantity: float = 0.0
    unit_cost: float = 0.0
    from_warehouse_id: Optional[int] = None
    to_warehouse_id: Optional[int] = None
    reference_no: Optional[str] = None
    movement_date: date
    supplier_id: Optional[int] = None
    customer_id: Optional[int] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None

class StockMovementCreate(StockMovementBase):
    pass

class StockMovementUpdate(BaseModel):
    movement_type: Optional[str] = None
    product_id: Optional[int] = None
    quantity: Optional[float] = None
    unit_cost: Optional[float] = None
    from_warehouse_id: Optional[int] = None
    to_warehouse_id: Optional[int] = None
    reference_no: Optional[str] = None
    movement_date: Optional[date] = None
    supplier_id: Optional[int] = None
    customer_id: Optional[int] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None

class StockMovement(StockMovementBase):
    id: int
    created_at: Optional[datetime] = None
    # Present when the movement was auto-posted from a sales document. The UI
    # uses it to mark the row as owned by that document rather than editable.
    source_document_id: Optional[int] = None
    source_purchase_id: Optional[int] = None
    source_line_id: Optional[int] = None
    product: Optional[Product] = None
    supplier: Optional[Supplier] = None
    customer: Optional[Customer] = None
    from_warehouse: Optional[Warehouse] = None
    to_warehouse: Optional[Warehouse] = None

    @computed_field
    @property
    def total_value(self) -> float:
        return round((self.quantity or 0.0) * (self.unit_cost or 0.0), 2)

    class Config:
        from_attributes = True

# --- Sales documents (Order / Delivery / Invoice / Return / Credit Note) ---
class SalesLineBase(BaseModel):
    product_id: int
    quantity: float = 0.0
    unit_price: float = 0.0
    discount_pct: float = 0.0
    tax_id: Optional[int] = None
    remarks: Optional[str] = None

class SalesLineCreate(SalesLineBase):
    pass

class SalesLine(SalesLineBase):
    id: int
    product: Optional[Product] = None
    tax: Optional[Tax] = None

    @computed_field
    @property
    def line_subtotal(self) -> float:
        """Quantity x price, less the line discount."""
        gross = (self.quantity or 0.0) * (self.unit_price or 0.0)
        return round(gross * (1 - (self.discount_pct or 0.0) / 100.0), 2)

    @computed_field
    @property
    def line_tax(self) -> float:
        rate = self.tax.rate if self.tax else 0.0
        return round(self.line_subtotal * (rate or 0.0) / 100.0, 2)

    @computed_field
    @property
    def line_total(self) -> float:
        return round(self.line_subtotal + self.line_tax, 2)

    class Config:
        from_attributes = True

class SalesDocumentBase(BaseModel):
    doc_type: str
    doc_no: str
    doc_date: date
    customer_id: int
    parent_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    reference_no: Optional[str] = None
    status: str = "DRAFT"
    notes: Optional[str] = None

class SalesDocumentCreate(SalesDocumentBase):
    lines: List[SalesLineCreate] = []

class SalesDocumentUpdate(BaseModel):
    doc_no: Optional[str] = None
    doc_date: Optional[date] = None
    customer_id: Optional[int] = None
    parent_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    reference_no: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    # Omit `lines` to leave them untouched; send a list to replace them wholesale.
    lines: Optional[List[SalesLineCreate]] = None

class SalesDocument(SalesDocumentBase):
    id: int
    created_at: Optional[datetime] = None
    customer: Optional[Customer] = None
    warehouse: Optional[Warehouse] = None
    lines: List[SalesLine] = []

    @computed_field
    @property
    def subtotal(self) -> float:
        return round(sum(line.line_subtotal for line in self.lines), 2)

    @computed_field
    @property
    def tax_total(self) -> float:
        return round(sum(line.line_tax for line in self.lines), 2)

    @computed_field
    @property
    def grand_total(self) -> float:
        return round(self.subtotal + self.tax_total, 2)

    @computed_field
    @property
    def line_count(self) -> int:
        return len(self.lines)

    class Config:
        from_attributes = True

# --- Purchase documents (PO / Goods Receipt / Invoice / Return / Debit Note) ---
# Line shape is identical to sales; only the counterparty differs on the header.
class PurchaseLineCreate(SalesLineBase):
    pass

class PurchaseLine(SalesLine):
    pass

class PurchaseDocumentBase(BaseModel):
    doc_type: str
    doc_no: str
    doc_date: date
    supplier_id: int
    parent_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    reference_no: Optional[str] = None
    status: str = "DRAFT"
    notes: Optional[str] = None

class PurchaseDocumentCreate(PurchaseDocumentBase):
    lines: List[PurchaseLineCreate] = []

class PurchaseDocumentUpdate(BaseModel):
    doc_no: Optional[str] = None
    doc_date: Optional[date] = None
    supplier_id: Optional[int] = None
    parent_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    reference_no: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[List[PurchaseLineCreate]] = None

class PurchaseDocument(PurchaseDocumentBase):
    id: int
    created_at: Optional[datetime] = None
    supplier: Optional[Supplier] = None
    warehouse: Optional[Warehouse] = None
    lines: List[PurchaseLine] = []

    @computed_field
    @property
    def subtotal(self) -> float:
        return round(sum(line.line_subtotal for line in self.lines), 2)

    @computed_field
    @property
    def tax_total(self) -> float:
        return round(sum(line.line_tax for line in self.lines), 2)

    @computed_field
    @property
    def grand_total(self) -> float:
        return round(self.subtotal + self.tax_total, 2)

    @computed_field
    @property
    def line_count(self) -> int:
        return len(self.lines)

    class Config:
        from_attributes = True

# --- Trading book ---
class TradeBase(BaseModel):
    trade_no: str
    side: str
    product_id: int
    quantity: float = 0.0
    price: float = 0.0
    fees: float = 0.0
    trade_date: date
    counterparty: Optional[str] = None
    reference_no: Optional[str] = None
    notes: Optional[str] = None

class TradeCreate(TradeBase):
    pass

class TradeUpdate(BaseModel):
    trade_no: Optional[str] = None
    side: Optional[str] = None
    product_id: Optional[int] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    fees: Optional[float] = None
    trade_date: Optional[date] = None
    counterparty: Optional[str] = None
    reference_no: Optional[str] = None
    notes: Optional[str] = None

class Trade(TradeBase):
    id: int
    created_at: Optional[datetime] = None
    product: Optional[Product] = None
    # Realized profit, present only on sells (filled in by the FIFO pass).
    realized_pnl: Optional[float] = None
    cost_of_sale: Optional[float] = None

    @computed_field
    @property
    def gross_value(self) -> float:
        return round((self.quantity or 0.0) * (self.price or 0.0), 2)

    @computed_field
    @property
    def net_value(self) -> float:
        """Cash actually moved: a buy costs more with fees, a sell nets less."""
        gross = self.gross_value
        fees = self.fees or 0.0
        return round(gross + fees if self.side == "BUY" else gross - fees, 2)

    class Config:
        from_attributes = True

class OpenLot(BaseModel):
    buy_trade_id: int
    trade_no: str
    trade_date: date
    quantity: float
    unit_cost: float

class Position(BaseModel):
    """What is currently held in one product, and what it is worth."""
    product_id: int
    ticker: str
    product_name: str
    quantity: float
    average_cost: float
    cost_value: float
    market_price: float
    market_value: float
    unrealized_pnl: float
    realized_pnl: float
    open_lots: List[OpenLot] = []

class ProfitSummary(BaseModel):
    positions: List[Position] = []
    total_realized: float = 0.0
    total_unrealized: float = 0.0
    total_cost_value: float = 0.0
    total_market_value: float = 0.0
    total_fees: float = 0.0

# --- Accounting: chart of accounts ---
class ChartOfAccountBase(BaseModel):
    code: str
    name: str
    account_type: str
    account_group: str = "OTHER"
    parent_id: Optional[int] = None
    opening_balance: float = 0.0
    opening_is_debit: bool = True
    description: Optional[str] = None
    is_active: bool = True

class ChartOfAccountCreate(ChartOfAccountBase):
    pass

class ChartOfAccountUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    account_type: Optional[str] = None
    account_group: Optional[str] = None
    parent_id: Optional[int] = None
    opening_balance: Optional[float] = None
    opening_is_debit: Optional[bool] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ChartOfAccount(ChartOfAccountBase):
    id: int

    class Config:
        from_attributes = True

# --- Accounting: journal entries ---
class JournalLineBase(BaseModel):
    account_id: int
    debit: float = 0.0
    credit: float = 0.0
    line_narration: Optional[str] = None

class JournalLineCreate(JournalLineBase):
    pass

class JournalLine(JournalLineBase):
    id: int
    account: Optional[ChartOfAccount] = None

    class Config:
        from_attributes = True

class JournalEntryBase(BaseModel):
    entry_no: str
    entry_type: str = "JOURNAL"
    entry_date: date
    narration: Optional[str] = None
    reference_no: Optional[str] = None
    party_type: Optional[str] = None
    party_id: Optional[int] = None
    status: str = "POSTED"

class JournalEntryCreate(JournalEntryBase):
    lines: List[JournalLineCreate] = []

class JournalEntryUpdate(BaseModel):
    entry_no: Optional[str] = None
    entry_date: Optional[date] = None
    narration: Optional[str] = None
    reference_no: Optional[str] = None
    party_type: Optional[str] = None
    party_id: Optional[int] = None
    status: Optional[str] = None
    lines: Optional[List[JournalLineCreate]] = None

class JournalEntry(JournalEntryBase):
    id: int
    created_at: Optional[datetime] = None
    lines: List[JournalLine] = []
    party_name: Optional[str] = None

    @computed_field
    @property
    def total_debit(self) -> float:
        return round(sum(l.debit or 0.0 for l in self.lines), 2)

    @computed_field
    @property
    def total_credit(self) -> float:
        return round(sum(l.credit or 0.0 for l in self.lines), 2)

    @computed_field
    @property
    def line_count(self) -> int:
        return len(self.lines)

    class Config:
        from_attributes = True

# --- Accounting: reports ---
class LedgerLine(BaseModel):
    """One movement on an account, with the balance after it."""
    entry_id: int
    entry_no: str
    entry_date: date
    entry_type: str
    narration: Optional[str] = None
    reference_no: Optional[str] = None
    contra_accounts: str = ""      # the other side(s) of the same voucher
    debit: float = 0.0
    credit: float = 0.0
    running_balance: float = 0.0

class LedgerReport(BaseModel):
    account_id: int
    code: str
    name: str
    account_type: str
    account_group: str
    opening_balance: float = 0.0
    total_debit: float = 0.0
    total_credit: float = 0.0
    closing_balance: float = 0.0
    lines: List[LedgerLine] = []

class TrialBalanceRow(BaseModel):
    account_id: int
    code: str
    name: str
    account_type: str
    account_group: str
    debit: float = 0.0
    credit: float = 0.0

class TrialBalance(BaseModel):
    rows: List[TrialBalanceRow] = []
    total_debit: float = 0.0
    total_credit: float = 0.0
    is_balanced: bool = True

class ReportSection(BaseModel):
    title: str
    rows: List[TrialBalanceRow] = []
    total: float = 0.0

class ProfitAndLoss(BaseModel):
    income: ReportSection
    expenses: ReportSection
    net_profit: float = 0.0

class BalanceSheet(BaseModel):
    assets: ReportSection
    liabilities: ReportSection
    equity: ReportSection
    net_profit: float = 0.0
    total_assets: float = 0.0
    total_liabilities_and_equity: float = 0.0
    is_balanced: bool = True

class CashBankAccount(BaseModel):
    """A cash or bank account with its current balance."""
    account_id: int
    code: str
    name: str
    account_group: str          # CASH | BANK
    balance: float = 0.0

class CashBankSummary(BaseModel):
    accounts: List[CashBankAccount] = []
    total_cash: float = 0.0
    total_bank: float = 0.0
    total: float = 0.0

class PartyBalance(BaseModel):
    party_type: str
    party_id: Optional[int] = None
    party_name: str
    debit: float = 0.0
    credit: float = 0.0
    balance: float = 0.0

# --- Reports ---
# Nothing here is stored: every figure is aggregated from the documents,
# movements and journals that already exist, so a report can never disagree
# with the records it summarises.
class ReportBreakdownRow(BaseModel):
    key: str                       # product ticker, party name or period label
    label: str
    count: int = 0
    quantity: float = 0.0
    subtotal: float = 0.0
    tax: float = 0.0
    total: float = 0.0

class DocumentReport(BaseModel):
    doc_type: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    document_count: int = 0
    subtotal: float = 0.0
    tax_total: float = 0.0
    grand_total: float = 0.0
    by_party: List[ReportBreakdownRow] = []
    by_product: List[ReportBreakdownRow] = []
    by_period: List[ReportBreakdownRow] = []
    by_status: List[ReportBreakdownRow] = []

class StockReportRow(BaseModel):
    product_id: int
    ticker: str
    product_name: str
    unit: Optional[str] = None
    warehouse_id: int
    warehouse_name: str
    opening_qty: float = 0.0
    in_qty: float = 0.0
    out_qty: float = 0.0
    closing_qty: float = 0.0
    avg_cost: float = 0.0
    stock_value: float = 0.0

class StockReport(BaseModel):
    rows: List[StockReportRow] = []
    total_closing_qty: float = 0.0
    total_stock_value: float = 0.0

class GstRateRow(BaseModel):
    tax_name: str
    rate: float = 0.0
    taxable_value: float = 0.0
    tax_amount: float = 0.0

class GstReport(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    output_rows: List[GstRateRow] = []      # tax charged on sales
    input_rows: List[GstRateRow] = []       # tax paid on purchases
    output_taxable: float = 0.0
    output_tax: float = 0.0
    input_taxable: float = 0.0
    input_tax: float = 0.0
    net_payable: float = 0.0

class OutstandingReport(BaseModel):
    receivables: List[PartyBalance] = []
    payables: List[PartyBalance] = []
    total_receivable: float = 0.0
    total_payable: float = 0.0
    net_position: float = 0.0

# --- Dashboard ---
# One call for the whole overview screen. Eight separate widget requests would
# be eight round trips and eight chances to show figures from different moments.
class SeriesPoint(BaseModel):
    label: str
    value: float = 0.0

class NamedAmount(BaseModel):
    label: str
    sublabel: Optional[str] = None
    amount: float = 0.0
    count: int = 0

class DashboardRevenue(BaseModel):
    total: float = 0.0
    subtotal: float = 0.0
    tax: float = 0.0
    invoice_count: int = 0
    average_invoice: float = 0.0
    best_month: float = 0.0
    by_month: List[SeriesPoint] = []

class DashboardPipeline(BaseModel):
    orders: int = 0
    deliveries: int = 0
    invoices: int = 0
    order_value: float = 0.0
    invoiced_value: float = 0.0
    conversion_pct: float = 0.0     # invoices raised per order taken

class DashboardCustomers(BaseModel):
    total: int = 0
    active: int = 0
    with_balance: int = 0
    total_receivable: float = 0.0
    top: List[NamedAmount] = []

class DashboardPayables(BaseModel):
    total_payable: float = 0.0
    supplier_count: int = 0
    top: List[NamedAmount] = []

class DashboardInventory(BaseModel):
    product_count: int = 0
    total_quantity: float = 0.0
    total_value: float = 0.0
    location_count: int = 0
    out_of_stock: int = 0
    by_location: List[SeriesPoint] = []
    by_product: List[SeriesPoint] = []

class DashboardAttention(BaseModel):
    """Things a person actually has to do something about."""
    draft_sales: int = 0
    draft_purchases: int = 0
    draft_journals: int = 0
    out_of_stock: int = 0
    unbalanced_books: bool = False

class DashboardActivity(BaseModel):
    kind: str                       # SALES | PURCHASE | JOURNAL
    reference: str
    party: Optional[str] = None
    entry_date: date
    amount: float = 0.0
    status: str = ""

class DashboardTrading(BaseModel):
    realized: float = 0.0
    unrealized: float = 0.0
    open_positions: int = 0

class DashboardSummary(BaseModel):
    generated_for: Optional[date] = None
    revenue: DashboardRevenue
    pipeline: DashboardPipeline
    customers: DashboardCustomers
    payables: DashboardPayables
    inventory: DashboardInventory
    attention: DashboardAttention
    trading: DashboardTrading
    recent: List[DashboardActivity] = []

class StockBalance(BaseModel):
    """On-hand quantity for one product in one warehouse."""
    product_id: int
    ticker: str
    product_name: str
    warehouse_id: int
    warehouse_name: str
    opening_qty: float
    in_qty: float
    out_qty: float
    on_hand: float


# --- Point of sale ---------------------------------------------------------

class PosLineCreate(BaseModel):
    """A cart line. Price is sent from the till so a mid-sale price change
    cannot silently reprice a scanned item."""
    product_id: int
    quantity: float = 1.0
    unit_price: float = 0.0
    discount_pct: float = 0.0
    tax_id: Optional[int] = None


class PosSaleCreate(BaseModel):
    customer_id: Optional[int] = None      # falls back to the walk-in customer
    warehouse_id: Optional[int] = None     # falls back to the default warehouse
    payment_method: str = "CASH"
    amount_tendered: float = 0.0
    notes: Optional[str] = None

    # Card / UPI: the issuer and the last four digits, which is all that may be
    # kept and all that reconciliation needs.
    payment_bank: Optional[str] = None
    payment_last4: Optional[str] = None
    payment_reference: Optional[str] = None

    # On account: who owes the money.
    bill_to_name: Optional[str] = None
    bill_to_address: Optional[str] = None

    lines: List[PosLineCreate] = []


class PosSale(BaseModel):
    id: int
    receipt_no: str
    sale_date: date
    customer_id: int
    warehouse_id: int
    delivery_id: Optional[int] = None
    invoice_id: Optional[int] = None
    journal_entry_id: Optional[int] = None
    payment_method: str
    amount_total: float
    amount_tendered: float
    change_given: float
    payment_bank: Optional[str] = None
    payment_last4: Optional[str] = None
    payment_reference: Optional[str] = None
    bill_to_name: Optional[str] = None
    bill_to_address: Optional[str] = None
    cashier_id: Optional[int] = None
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    customer: Optional[Customer] = None
    warehouse: Optional[Warehouse] = None
    # The invoice carries the lines and the tax breakdown, so a receipt can be
    # reprinted from this one payload without a second call.
    invoice: Optional[SalesDocument] = None

    # Filled in by the router: the name lives on the user rather than the sale,
    # and a computed property cannot be written to.
    cashier_name: Optional[str] = None

    @computed_field
    @property
    def line_count(self) -> int:
        return len(self.invoice.lines) if self.invoice else 0

    class Config:
        from_attributes = True


class PosProduct(BaseModel):
    """A product as the till needs it: price, tax and what is actually on the
    shelf, so a cashier is not offered something that cannot be sold."""
    id: int
    ticker: Optional[str] = None
    name: Optional[str] = None
    current_price: float = 0.0
    unit_name: Optional[str] = None
    category_name: Optional[str] = None
    tax_id: Optional[int] = None
    tax_rate: float = 0.0
    on_hand: float = 0.0


class PosPaymentMethod(BaseModel):
    code: str
    label: str
    # Which account the money lands in. Null means it stays in receivables.
    account_id: Optional[int] = None
    account_name: Optional[str] = None
    takes_tender: bool = False
    # What the till must collect before this method can be taken, so the screen
    # asks for exactly what the server will insist on.
    needs_instrument: bool = False
    needs_bill_to: bool = False


class PosTerminal(BaseModel):
    """Everything the till needs to open, in one call."""
    warehouse: Optional[Warehouse] = None
    warehouses: List[Warehouse] = []
    walk_in_customer: Optional[Customer] = None
    customers: List[Customer] = []
    payment_methods: List[PosPaymentMethod] = []
    taxes: List[Tax] = []
    next_receipt_no: str


class PosSummaryRow(BaseModel):
    payment_method: str
    sale_count: int
    total: float


class PosSummary(BaseModel):
    """The day's takings, for cashing up."""
    date_from: date
    date_to: date
    sale_count: int
    gross_total: float
    voided_count: int
    voided_total: float
    by_method: List[PosSummaryRow] = []


# --- System configuration --------------------------------------------------

class SettingField(BaseModel):
    """One setting, carrying enough for a screen to render and police it."""
    key: str
    label: str
    help: Optional[str] = None
    type: str                       # "int" | "bool"
    value: Any
    default: Any
    min: Optional[int] = None
    max: Optional[int] = None


class SettingSection(BaseModel):
    section: str
    fields: List[SettingField] = []


class SettingUpdate(BaseModel):
    values: Dict[str, Any] = {}


class PasswordPolicy(BaseModel):
    min_length: int
    require_upper: bool
    require_digit: bool
    require_symbol: bool


class ApiKeyCreate(BaseModel):
    name: str
    role: str = "VIEWER"
    # None falls back to the configured default lifetime.
    expires_days: Optional[int] = None


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class ApiKey(BaseModel):
    id: int
    name: str
    key_prefix: str
    role: str
    is_active: bool
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    # Returned only by the call that creates the key, and never again.
    plain_key: Optional[str] = None

    class Config:
        from_attributes = True


class Notification(BaseModel):
    level: str                      # danger | warning | info
    category: str
    title: str
    detail: str
    link: Optional[str] = None


class NotificationFeed(BaseModel):
    count: int = 0
    danger: int = 0
    warning: int = 0
    info: int = 0
    items: List[Notification] = []


# --- Notes -----------------------------------------------------------------

class UserNoteBase(BaseModel):
    title: str = ""
    content: Optional[str] = None
    pinned: bool = False


class UserNoteCreate(UserNoteBase):
    pass


class UserNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    pinned: Optional[bool] = None


class UserNote(UserNoteBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @computed_field
    @property
    def preview(self) -> str:
        """First line of the body, for a list that has to fit many notes."""
        body = (self.content or "").strip()
        if not body:
            return ""
        first = body.splitlines()[0]
        return first[:120] + ("..." if len(first) > 120 else "")

    class Config:
        from_attributes = True


# --- Holidays ---------------------------------------------------------------

class HolidayBase(BaseModel):
    holiday_date: date
    name: str
    holiday_type: str = "PUBLIC"
    is_recurring: bool = False
    description: Optional[str] = None
    is_active: bool = True


class HolidayCreate(HolidayBase):
    pass


class HolidayUpdate(BaseModel):
    holiday_date: Optional[date] = None
    name: Optional[str] = None
    holiday_type: Optional[str] = None
    is_recurring: Optional[bool] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class Holiday(HolidayBase):
    id: int
    # True when this is a recurring holiday shown in a year other than the one
    # it was entered against. Set when the projection is made — it cannot be
    # derived afterwards, because the projection carries the viewed year's date.
    projected: bool = False

    class Config:
        from_attributes = True


class CalendarDay(BaseModel):
    """One day as the calendar needs it."""
    day: date
    holiday: Optional[Holiday] = None
    # True when the holiday is a recurring one shown in a year other than the
    # one it was entered against — editing it edits the original.
    projected: bool = False
    is_weekend: bool = False


class HolidayCalendar(BaseModel):
    year: int
    month: Optional[int] = None
    days: List[CalendarDay] = []
    holiday_count: int = 0
