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
    <CurrencyProvider>
      <div className={sidebarOpen ? 'dashboard-layout' : 'dashboard-layout sidebar-collapsed'}>
        <Sidebar />
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
              <Route path="/" element={<Overview />} />
              <Route path="/settings" element={<Configuration />} />
              <Route path="/auth" element={<AuthUsers />} />
              <Route path="/master/products" element={<Products />} />
              <Route path="/master/categories" element={<Categories />} />
              <Route path="/master/units" element={<Units />} />
              <Route path="/master/customers" element={<Customers />} />
              <Route path="/master/suppliers" element={<Suppliers />} />
              <Route path="/master/tax" element={<Tax />} />
              <Route path="/master/warehouses" element={<Warehouses />} />
              <Route path="/inventory/opening" element={<OpeningStock />} />
              <Route path="/inventory/in" element={<StockIn />} />
              <Route path="/inventory/out" element={<StockOut />} />
              <Route path="/inventory/transfer" element={<StockTransfer />} />
              <Route path="/inventory/adjustment" element={<StockAdjustment />} />
              <Route path="/sales/order" element={<SalesOrder />} />
              <Route path="/sales/delivery" element={<Delivery />} />
              <Route path="/sales/invoice" element={<SalesInvoice />} />
              <Route path="/sales/return" element={<SalesReturn />} />
              <Route path="/sales/credit-note" element={<CreditNote />} />
              <Route path="/purchases/order" element={<PurchaseOrder />} />
              <Route path="/purchases/receipt" element={<GoodsReceipt />} />
              <Route path="/purchases/invoice" element={<PurchaseInvoice />} />
              <Route path="/purchases/return" element={<PurchaseReturn />} />
              <Route path="/purchases/debit-note" element={<DebitNote />} />
              <Route path="/trading/buy" element={<Buy />} />
              <Route path="/trading/sell" element={<Sell />} />
              <Route path="/trading/transactions" element={<Transactions />} />
              <Route path="/trading/profit" element={<ProfitCalc />} />
              <Route path="/accounts/chart" element={<ChartOfAccounts />} />
              <Route path="/accounts/ledger" element={<GeneralLedger />} />
              <Route path="/accounts/journal" element={<JournalEntries />} />
              <Route path="/accounts/cash-bank" element={<CashBankVoucher />} />
              {/* The old separate paths now land on the combined screen so
                  existing links and bookmarks keep working. */}
              <Route path="/accounts/cash" element={<CashBankVoucher />} />
              <Route path="/accounts/bank" element={<CashBankVoucher />} />
              <Route path="/accounts/receivables-payables" element={<ReceivablesPayables />} />
              {/* Old separate paths keep working. */}
              <Route path="/accounts/receivables" element={<ReceivablesPayables />} />
              <Route path="/accounts/payables" element={<ReceivablesPayables />} />
              <Route path="/accounts/payments-receipts" element={<PaymentsReceipts />} />
              {/* Old separate paths keep working. */}
              <Route path="/accounts/payments" element={<PaymentsReceipts />} />
              <Route path="/accounts/receipts" element={<PaymentsReceipts />} />
              <Route path="/accounts/expenses" element={<Expenses />} />
              <Route path="/accounts/tax" element={<TaxLedger />} />
              <Route path="/accounts/trial-balance" element={<TrialBalance />} />
              <Route path="/accounts/pl" element={<ProfitLoss />} />
              <Route path="/accounts/balance-sheet" element={<BalanceSheet />} />
              <Route path="/accounts/day-book" element={<DayBook />} />
              <Route path="/reports/sales" element={<SalesReport />} />
              <Route path="/reports/purchase" element={<PurchaseReport />} />
              <Route path="/reports/stock" element={<StockReport />} />
              <Route path="/reports/outstanding" element={<Outstanding />} />
              <Route path="/reports/ledger" element={<LedgerReport />} />
              <Route path="/reports/gst" element={<GstReport />} />
              <Route path="/reports/financials" element={<Financials />} />
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
  )
}

export default App;
