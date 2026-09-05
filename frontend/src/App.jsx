import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Overview from './pages/Overview';
import Configuration from './pages/Configuration';
import AuthUsers from './pages/AuthUsers';
import Products from './pages/masters/Products';
import Categories from './pages/masters/Categories';
import Units from './pages/masters/Units';
import Customers from './pages/masters/Customers';
import Suppliers from './pages/masters/Suppliers';
import Tax from './pages/masters/Tax';
import Warehouses from './pages/masters/Warehouses';
import OpeningStock from './pages/inventory/OpeningStock';
import StockIn from './pages/inventory/StockIn';
import StockOut from './pages/inventory/StockOut';
import StockTransfer from './pages/inventory/StockTransfer';
import StockAdjustment from './pages/inventory/StockAdjustment';
import SalesOrder from './pages/sales/SalesOrder';
import Delivery from './pages/sales/Delivery';
import SalesInvoice from './pages/sales/SalesInvoice';
import SalesReturn from './pages/sales/SalesReturn';
import CreditNote from './pages/sales/CreditNote';
import PurchaseOrder from './pages/purchases/PurchaseOrder';
import GoodsReceipt from './pages/purchases/GoodsReceipt';
import PurchaseInvoice from './pages/purchases/PurchaseInvoice';
import PurchaseReturn from './pages/purchases/PurchaseReturn';
import DebitNote from './pages/purchases/DebitNote';
import Buy from './pages/trading/Buy';
import Sell from './pages/trading/Sell';
import Transactions from './pages/trading/Transactions';
import ProfitCalc from './pages/trading/ProfitCalc';
import ChartOfAccounts from './pages/accounts/ChartOfAccounts';
import GeneralLedger from './pages/accounts/GeneralLedger';
import JournalEntries from './pages/accounts/JournalEntries';
import CashBankVoucher from './pages/accounts/CashBankVoucher';
import ReceivablesPayables from './pages/accounts/ReceivablesPayables';
import PaymentsReceipts from './pages/accounts/PaymentsReceipts';
import Expenses from './pages/accounts/Expenses';
import TaxLedger from './pages/accounts/TaxLedger';
import TrialBalance from './pages/accounts/TrialBalance';
import ProfitLoss from './pages/accounts/ProfitLoss';
import BalanceSheet from './pages/accounts/BalanceSheet';
import DayBook from './pages/accounts/DayBook';
import SalesReport from './pages/reports/SalesReport';
import PurchaseReport from './pages/reports/PurchaseReport';
import StockReport from './pages/reports/StockReport';
import Outstanding from './pages/reports/Outstanding';
import LedgerReport from './pages/reports/LedgerReport';
import GstReport from './pages/reports/GstReport';
import Financials from './pages/reports/Financials';
import Login from './pages/Login';

import { CurrencyProvider } from './context/CurrencyContext';
import { PermissionProvider } from './context/PermissionContext';
import RequireModule from './components/RequireModule';
import RolesPermissions from './pages/RolesPermissions';
import { preferencesApi } from './api';

// Below this the sidebar overlays the content instead of sitting beside it,
// so it starts closed and closes again on navigation.
const OVERLAY_BREAKPOINT = 900;

// The signed-in user's id, used only to key the local cache below.
function currentUserId() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')?.id ?? null;
  } catch {
    return null;
  }
}

// Preferences live on the server so they follow the user to any browser. This
// mirror is keyed by user id purely so the sidebar paints in the right state
// before the fetch returns — two people sharing a machine never see each
// other's, and the server always wins once it answers.
function cachedPref(key, fallback) {
  const id = currentUserId();
  if (id === null) return fallback;
  const value = localStorage.getItem(`prefs:${id}:${key}`);
  return value === null ? fallback : value;
}

function cachePref(key, value) {
  const id = currentUserId();
  if (id !== null) localStorage.setItem(`prefs:${id}:${key}`, String(value));
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Never open over the content on a small screen, whatever was saved.
    if (window.innerWidth <= OVERLAY_BREAKPOINT) return false;
    return cachedPref('sidebarOpen', 'true') !== 'false';
  });
  // Until the server has answered, a toggle would race the load and could
  // save a value the user never chose.
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const location = useLocation();

  // Pull the authoritative preferences once signed in.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    preferencesApi.get()
      .then(({ preferences }) => {
        if (cancelled) return;
        const saved = preferences?.sidebarOpen;
        if (saved !== undefined && saved !== null) {
          cachePref('sidebarOpen', saved);
          // A narrow screen still overrides — the preference is about intent,
          // not about covering the content on a phone.
          if (window.innerWidth > OVERLAY_BREAKPOINT) setSidebarOpen(saved !== 'false');
        }
      })
      .catch(() => { /* offline or signed out: the cached value stands */ })
      .finally(() => { if (!cancelled) setPrefsLoaded(true); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Persist a deliberate change. Skipped on a narrow screen, where opening and
  // closing is navigation rather than a stated preference.
  const setSidebarPreference = (next) => {
    setSidebarOpen(next);
    if (!prefsLoaded || window.innerWidth <= OVERLAY_BREAKPOINT) return;
    cachePref('sidebarOpen', next);
    preferencesApi.save({ sidebarOpen: String(next) }).catch(() => {});
  };

  // Picking a menu item on a narrow screen should get the sidebar out of the way.
  useEffect(() => {
    if (window.innerWidth <= OVERLAY_BREAKPOINT) setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // The api layer clears a dead session and fires this; drop to the login
  // screen rather than leaving the user on a page whose saves quietly fail.
  useEffect(() => {
    const onExpired = () => {
      setIsAuthenticated(false);
      setPrefsLoaded(false);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    // The next person to sign in must load their own settings, not inherit
    // whatever is still in state from this session.
    setPrefsLoaded(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <PermissionProvider enabled={isAuthenticated}>
    <CurrencyProvider>
      <div className={sidebarOpen ? 'dashboard-layout' : 'dashboard-layout sidebar-collapsed'}>
        <Sidebar collapsed={!sidebarOpen} />
        {/* Only rendered on narrow screens, where the sidebar covers content. */}
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarPreference(false)} />
        )}
        <main className="main-content">
          <TopBar onLogout={handleLogout}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarPreference(!sidebarOpen)} />
          <div className="animate-fade-in" style={{ flex: 1, overflowY: 'auto' }}>
            <Routes>
              <Route path="/" element={<RequireModule module="DASHBOARD"><Overview /></RequireModule>} />
              <Route path="/settings" element={<RequireModule module="SETTINGS"><Configuration /></RequireModule>} />
              <Route path="/auth" element={<RequireModule module="AUTH_USERS"><AuthUsers /></RequireModule>} />
              <Route path="/auth/roles" element={<RequireModule module="AUTH_USERS"><RolesPermissions /></RequireModule>} />
              <Route path="/master/products" element={<RequireModule module="MASTER_DATA"><Products /></RequireModule>} />
              <Route path="/master/categories" element={<RequireModule module="MASTER_DATA"><Categories /></RequireModule>} />
              <Route path="/master/units" element={<RequireModule module="MASTER_DATA"><Units /></RequireModule>} />
              <Route path="/master/customers" element={<RequireModule module="MASTER_DATA"><Customers /></RequireModule>} />
              <Route path="/master/suppliers" element={<RequireModule module="MASTER_DATA"><Suppliers /></RequireModule>} />
              <Route path="/master/tax" element={<RequireModule module="MASTER_DATA"><Tax /></RequireModule>} />
              <Route path="/master/warehouses" element={<RequireModule module="MASTER_DATA"><Warehouses /></RequireModule>} />
              <Route path="/inventory/opening" element={<RequireModule module="INVENTORY"><OpeningStock /></RequireModule>} />
              <Route path="/inventory/in" element={<RequireModule module="INVENTORY"><StockIn /></RequireModule>} />
              <Route path="/inventory/out" element={<RequireModule module="INVENTORY"><StockOut /></RequireModule>} />
              <Route path="/inventory/transfer" element={<RequireModule module="INVENTORY"><StockTransfer /></RequireModule>} />
              <Route path="/inventory/adjustment" element={<RequireModule module="INVENTORY"><StockAdjustment /></RequireModule>} />
              <Route path="/sales/order" element={<RequireModule module="SALES"><SalesOrder /></RequireModule>} />
              <Route path="/sales/delivery" element={<RequireModule module="SALES"><Delivery /></RequireModule>} />
              <Route path="/sales/invoice" element={<RequireModule module="SALES"><SalesInvoice /></RequireModule>} />
              <Route path="/sales/return" element={<RequireModule module="SALES"><SalesReturn /></RequireModule>} />
              <Route path="/sales/credit-note" element={<RequireModule module="SALES"><CreditNote /></RequireModule>} />
              <Route path="/purchases/order" element={<RequireModule module="PURCHASES"><PurchaseOrder /></RequireModule>} />
              <Route path="/purchases/receipt" element={<RequireModule module="PURCHASES"><GoodsReceipt /></RequireModule>} />
              <Route path="/purchases/invoice" element={<RequireModule module="PURCHASES"><PurchaseInvoice /></RequireModule>} />
              <Route path="/purchases/return" element={<RequireModule module="PURCHASES"><PurchaseReturn /></RequireModule>} />
              <Route path="/purchases/debit-note" element={<RequireModule module="PURCHASES"><DebitNote /></RequireModule>} />
              <Route path="/trading/buy" element={<RequireModule module="TRADING"><Buy /></RequireModule>} />
              <Route path="/trading/sell" element={<RequireModule module="TRADING"><Sell /></RequireModule>} />
              <Route path="/trading/transactions" element={<RequireModule module="TRADING"><Transactions /></RequireModule>} />
              <Route path="/trading/profit" element={<RequireModule module="TRADING"><ProfitCalc /></RequireModule>} />
              <Route path="/accounts/chart" element={<RequireModule module="ACCOUNTS"><ChartOfAccounts /></RequireModule>} />
              <Route path="/accounts/ledger" element={<RequireModule module="ACCOUNTS"><GeneralLedger /></RequireModule>} />
              <Route path="/accounts/journal" element={<RequireModule module="ACCOUNTS"><JournalEntries /></RequireModule>} />
              <Route path="/accounts/cash-bank" element={<RequireModule module="ACCOUNTS"><CashBankVoucher /></RequireModule>} />
              {/* The old separate paths now land on the combined screen so
                  existing links and bookmarks keep working. */}
              <Route path="/accounts/cash" element={<RequireModule module="ACCOUNTS"><CashBankVoucher /></RequireModule>} />
              <Route path="/accounts/bank" element={<RequireModule module="ACCOUNTS"><CashBankVoucher /></RequireModule>} />
              <Route path="/accounts/receivables-payables" element={<RequireModule module="ACCOUNTS"><ReceivablesPayables /></RequireModule>} />
              {/* Old separate paths keep working. */}
              <Route path="/accounts/receivables" element={<RequireModule module="ACCOUNTS"><ReceivablesPayables /></RequireModule>} />
              <Route path="/accounts/payables" element={<RequireModule module="ACCOUNTS"><ReceivablesPayables /></RequireModule>} />
              <Route path="/accounts/payments-receipts" element={<RequireModule module="ACCOUNTS"><PaymentsReceipts /></RequireModule>} />
              {/* Old separate paths keep working. */}
              <Route path="/accounts/payments" element={<RequireModule module="ACCOUNTS"><PaymentsReceipts /></RequireModule>} />
              <Route path="/accounts/receipts" element={<RequireModule module="ACCOUNTS"><PaymentsReceipts /></RequireModule>} />
              <Route path="/accounts/expenses" element={<RequireModule module="ACCOUNTS"><Expenses /></RequireModule>} />
              <Route path="/accounts/tax" element={<RequireModule module="ACCOUNTS"><TaxLedger /></RequireModule>} />
              <Route path="/accounts/trial-balance" element={<RequireModule module="ACCOUNTS"><TrialBalance /></RequireModule>} />
              <Route path="/accounts/pl" element={<RequireModule module="ACCOUNTS"><ProfitLoss /></RequireModule>} />
              <Route path="/accounts/balance-sheet" element={<RequireModule module="ACCOUNTS"><BalanceSheet /></RequireModule>} />
              <Route path="/accounts/day-book" element={<RequireModule module="ACCOUNTS"><DayBook /></RequireModule>} />
              <Route path="/reports/sales" element={<RequireModule module="REPORTS"><SalesReport /></RequireModule>} />
              <Route path="/reports/purchase" element={<RequireModule module="REPORTS"><PurchaseReport /></RequireModule>} />
              <Route path="/reports/stock" element={<RequireModule module="REPORTS"><StockReport /></RequireModule>} />
              <Route path="/reports/outstanding" element={<RequireModule module="REPORTS"><Outstanding /></RequireModule>} />
              <Route path="/reports/ledger" element={<RequireModule module="REPORTS"><LedgerReport /></RequireModule>} />
              <Route path="/reports/gst" element={<RequireModule module="REPORTS"><GstReport /></RequireModule>} />
              <Route path="/reports/financials" element={<RequireModule module="REPORTS"><Financials /></RequireModule>} />
              {/* Catch-all for all the new ERP routes for now */}
              <Route path="*" element={
                <div className="glass-panel" style={{padding: '2rem'}}>
                  <h2>Module Under Construction</h2>
                  <p style={{color: 'var(--text-muted)', marginTop: '1rem'}}>
                    This module is part of the ERP expansion and is currently being built in the upcoming phases.
                  </p>
                </div>
              } />
            </Routes>
          </div>
        </main>
      </div>
    </CurrencyProvider>
    </PermissionProvider>
  )
}

export default App;
