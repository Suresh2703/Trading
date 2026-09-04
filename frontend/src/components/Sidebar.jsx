import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, Users, Database, Package, ShoppingCart, 
  ShoppingBag, TrendingUp, BookOpen, FileText, ChevronDown, ChevronRight, Settings 
} from 'lucide-react';
import './Sidebar.css';

const menuItems = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Auth & Users', path: '/auth', icon: Users },
  { 
    name: 'Master Data', icon: Database, 
    subItems: [
      { name: 'Products', path: '/master/products' },
      { name: 'Categories', path: '/master/categories' },
      { name: 'Customers', path: '/master/customers' },
      { name: 'Suppliers', path: '/master/suppliers' },
      { name: 'Units', path: '/master/units' },
      { name: 'Warehouses', path: '/master/warehouses' },
      { name: 'Tax/GST', path: '/master/tax' },
    ]
  },
  {
    name: 'Inventory', icon: Package,
    subItems: [
      { name: 'Opening Stock', path: '/inventory/opening' },
      { name: 'Stock In', path: '/inventory/in' },
      { name: 'Stock Out', path: '/inventory/out' },
      { name: 'Stock Transfer', path: '/inventory/transfer' },
      { name: 'Stock Adjustment', path: '/inventory/adjustment' },
    ]
  },
   //  { name: 'Quotation', path: '/sales/quotation' },
  {
    name: 'Sales', icon: ShoppingCart,
    subItems: [
      { name: 'Sales Order', path: '/sales/order' },
      { name: 'Delivery', path: '/sales/delivery' },
      { name: 'Sales Invoice', path: '/sales/invoice' },
      { name: 'Sales Return', path: '/sales/return' },
      { name: 'Credit Note', path: '/sales/credit-note' },
    ]
  },
  {
    name: 'Purchases', icon: ShoppingBag,
    subItems: [
      { name: 'Purchase Order', path: '/purchases/order' },
      { name: 'Goods Receipt', path: '/purchases/receipt' },
      { name: 'Purchase Invoice', path: '/purchases/invoice' },
      { name: 'Purchase Return', path: '/purchases/return' },
      { name: 'Debit Note', path: '/purchases/debit-note' },
    ]
  },
  {
    name: 'Trading', icon: TrendingUp,
    subItems: [
      { name: 'Buy', path: '/trading/buy' },
      { name: 'Sell', path: '/trading/sell' },
      { name: 'Transactions', path: '/trading/transactions' },
      { name: 'Profit Calc', path: '/trading/profit' },
    ]
  },
  {
    name: 'Accounts', icon: BookOpen,
    subItems: [
      { name: 'Chart of Accounts', path: '/accounts/chart' },
      { name: 'General Ledger', path: '/accounts/ledger' },
      { name: 'Journal Entries', path: '/accounts/journal' },
      { name: 'Cash & Bank Voucher', path: '/accounts/cash-bank' },
      { name: 'Receivables & Payables', path: '/accounts/receivables-payables' },
      { name: 'Payments & Receipts', path: '/accounts/payments-receipts' },
      { name: 'Expenses', path: '/accounts/expenses' },
      { name: 'GST/Tax', path: '/accounts/tax' },
      { name: 'Trial Balance', path: '/accounts/trial-balance' },
      { name: 'Profit & Loss', path: '/accounts/pl' },
      { name: 'Balance Sheet', path: '/accounts/balance-sheet' },
      { name: 'Day Book', path: '/accounts/day-book' },
    ]
  },
  {
    name: 'Reports', icon: FileText,
    subItems: [
      { name: 'Sales Report', path: '/reports/sales' },
      { name: 'Purchase Report', path: '/reports/purchase' },
      { name: 'Stock Report', path: '/reports/stock' },
      { name: 'Outstanding', path: '/reports/outstanding' },
      { name: 'Ledger', path: '/reports/ledger' },
      { name: 'GST Report', path: '/reports/gst' },
      { name: 'P&L / Balance Sheet', path: '/reports/financials' },
    ]
  }
];

function NavItem({ item }) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (item.subItems) {
    return (
      <div className="nav-group">
        <div className="nav-link" onClick={() => setIsOpen(!isOpen)}>
          <item.icon size={20} />
          <span>{item.name}</span>
          <div style={{marginLeft: 'auto'}}>
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
        {isOpen && (
          <div className="sub-menu">
            {item.subItems.map((sub, idx) => (
              <NavLink key={idx} to={sub.path} className={({isActive}) => isActive ? "sub-link active" : "sub-link"}>
                {sub.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink to={item.path} className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
      <item.icon size={20} />
      <span>{item.name}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="sidebar glass-panel">
      <div className="logo-container">
        <h2 className="text-gradient">ERP Trading</h2>
      </div>
      
      <nav className="nav-links">
        {menuItems.map((item, idx) => (
          <NavItem key={idx} item={item} />
        ))}
      </nav>

      <div className="sidebar-bottom" style={{marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)'}}>
         <NavLink to="/settings" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Settings size={20} />
            <span>Settings</span>
         </NavLink>
      </div>
    </aside>
  )
}
