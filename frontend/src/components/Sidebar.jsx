import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, Users, Database, Package, ShoppingCart, 
  ShoppingBag, TrendingUp, BookOpen, FileText, ChevronDown, ChevronRight, Settings 
} from 'lucide-react';
import './Sidebar.css';
import { usePermissions } from '../context/PermissionContext';

const menuItems = [
  { name: 'Dashboard', path: '/', icon: Home, module: 'DASHBOARD' },
  {
    name: 'Auth & Users', icon: Users, module: 'AUTH_USERS',
    subItems: [
      { name: 'Users', path: '/auth' },
      { name: 'Roles & Permissions', path: '/auth/roles' },
    ]
  },
  { 
    name: 'Master Data', icon: Database, module: 'MASTER_DATA', 
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
    name: 'Inventory', icon: Package, module: 'INVENTORY',
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
    name: 'Sales', icon: ShoppingCart, module: 'SALES',
    subItems: [
      { name: 'Point of Sale', path: '/sales/pos' },
      { name: 'Sales Order', path: '/sales/order' },
      { name: 'Delivery', path: '/sales/delivery' },
      { name: 'Sales Invoice', path: '/sales/invoice' },
      { name: 'Sales Return', path: '/sales/return' },
      { name: 'Credit Note', path: '/sales/credit-note' },
    ]
  },
  {
    name: 'Purchases', icon: ShoppingBag, module: 'PURCHASES',
    subItems: [
      { name: 'Purchase Order', path: '/purchases/order' },
      { name: 'Goods Receipt', path: '/purchases/receipt' },
      { name: 'Purchase Invoice', path: '/purchases/invoice' },
      { name: 'Purchase Return', path: '/purchases/return' },
      { name: 'Debit Note', path: '/purchases/debit-note' },
    ]
  },
  {
    name: 'Trading', icon: TrendingUp, module: 'TRADING',
    subItems: [
      { name: 'Buy', path: '/trading/buy' },
      { name: 'Sell', path: '/trading/sell' },
      { name: 'Transactions', path: '/trading/transactions' },
      { name: 'Profit Calc', path: '/trading/profit' },
    ]
  },
  {
    name: 'Accounts', icon: BookOpen, module: 'ACCOUNTS',
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
    name: 'Reports', icon: FileText, module: 'REPORTS',
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

function NavItem({ item, collapsed }) {
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();

  if (item.subItems) {
    // A group header is not a NavLink, so it gets no active state of its own.
    // Collapsed there is no sub-list visible either, which would leave nothing
    // showing where you are — so mark the group when one of its pages is open.
    const groupActive = item.subItems.some(sub => sub.path === pathname);

    return (
      <div className="nav-group">
        {/* Collapsed, the label is gone, so the title carries the name and the
            sub-menu appears as a flyout on hover rather than pushing the rail
            open. */}
        <div className={groupActive ? 'nav-link group-active' : 'nav-link'}
             title={collapsed ? item.name : undefined}
             onClick={() => !collapsed && setIsOpen(!isOpen)}>
          <item.icon size={20} />
          <span className="nav-label">{item.name}</span>
          <div className="nav-chevron" style={{ marginLeft: 'auto' }}>
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>

        {/* Rendered whenever the group is open, or always when collapsed so the
            flyout has something to show on hover. */}
        {(isOpen || collapsed) && (
          <div className={collapsed ? 'sub-menu flyout' : 'sub-menu'}>
            {collapsed && <div className="flyout-title">{item.name}</div>}
            {item.subItems.map((sub, idx) => (
              <NavLink key={idx} to={sub.path}
                       className={({ isActive }) => isActive ? "sub-link active" : "sub-link"}>
                {sub.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink to={item.path}
             title={collapsed ? item.name : undefined}
             className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
      <item.icon size={20} />
      <span className="nav-label">{item.name}</span>
    </NavLink>
  );
}

export default function Sidebar({ collapsed = false }) {
  const { canView, isLoading } = usePermissions();

  // Until permissions arrive, show nothing rather than the full menu — a menu
  // that appears and then loses half its entries reads as a glitch.
  const visibleItems = isLoading
    ? []
    : menuItems.filter(item => !item.module || canView(item.module));

  return (
    <aside className={collapsed ? 'sidebar glass-panel is-rail' : 'sidebar glass-panel'}>
      <div className="logo-container">
        {/* Collapsed there is no room for the wordmark, so it becomes a mark. */}
        <h2 className="text-gradient">{collapsed ? 'ERP' : 'ERP Trading'}</h2>
      </div>

      <nav className="nav-links">
        {visibleItems.map((item, idx) => (
          <NavItem key={idx} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {canView('SETTINGS') && <div className="sidebar-bottom" style={{marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)'}}>
         <NavLink to="/settings"
                  title={collapsed ? 'Settings' : undefined}
                  className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
            <Settings size={20} />
            <span className="nav-label">Settings</span>
         </NavLink>
      </div>}
    </aside>
  )
}
