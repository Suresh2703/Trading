import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { BarChart3, Bell, LayoutGrid, MoreHorizontal } from 'lucide-react';

import Logo from '../components/Logo';
import { usePermissions } from '../context/PermissionContext';
import { notificationsApi } from '../api';
import { useLiveData } from './useLiveData';
import Summary from './Summary';
import Reports from './Reports';
import Alerts from './Alerts';
import More from './More';
import './MobileApp.css';

/**
 * The installed phone app.
 *
 * A separate shell rather than the desktop layout narrowed down: the sidebar,
 * top bar and footer all assume a window wide enough to put things side by
 * side, and a phone has no room for any of them. What is left is a title, the
 * screen, and four destinations along the bottom where a thumb reaches.
 *
 * It reuses the desktop app's API layer, session and permissions wholesale —
 * this is a different surface onto the same system, not a second system.
 */
export default function MobileApp({ onLogout }) {
  const { canView } = usePermissions();

  // Only for the badge. The Alerts screen fetches its own copy, which the
  // service worker serves from cache, so this costs one request per session
  // rather than one per tab switch.
  const { data: feed } = useLiveData(() => notificationsApi.feed(), []);
  const urgent = feed ? feed.danger + feed.warning : 0;

  return (
    <div className="m-app">
      <header className="m-topbar">
        <Logo size={26} wordmark="ERP Trading" />
      </header>

      <main className="m-main">
        {/* Absolute paths: this <Routes> is rendered by App directly rather
            than nested under a parent <Route>, so nothing is stripped from
            the pathname before it is matched here. */}
        <Routes>
          <Route path="/m" element={<Summary />} />
          <Route path="/m/reports" element={<ReportsRoute />} />
          <Route path="/m/alerts" element={<Alerts />} />
          <Route path="/m/more" element={<More onLogout={onLogout} />} />
          {/* A deep link into a desktop-only path lands on the summary rather
              than a dead screen inside the app. */}
          <Route path="*" element={<Navigate to="/m" replace />} />
        </Routes>
      </main>

      <nav className="m-tabs" aria-label="Sections">
        <Tab to="/m" icon={LayoutGrid} label="Summary" end />
        {canView('REPORTS') && <Tab to="/m/reports" icon={BarChart3} label="Reports" />}
        <Tab to="/m/alerts" icon={Bell} label="Alerts" badge={urgent} />
        <Tab to="/m/more" icon={MoreHorizontal} label="More" />
      </nav>
    </div>
  );
}

/**
 * The reports screen behind its module permission.
 *
 * Permissions arrive a moment after the app mounts, and until they do
 * `canView` answers false for everything — so deciding here without waiting
 * would bounce every user off the screen on a cold start, whatever their
 * role. The desktop guard waits for the same reason.
 */
function ReportsRoute() {
  const { canView, isLoading } = usePermissions();

  if (isLoading) return <div className="m-empty">Checking access...</div>;
  if (!canView('REPORTS')) return <Navigate to="/m" replace />;
  return <Reports />;
}

function Tab({ to, icon: Icon, label, badge, end }) {
  return (
    <NavLink to={to} end={end}
             className={({ isActive }) => `m-tab${isActive ? ' is-active' : ''}`}>
      <span className="m-tab-icon">
        <Icon size={21} />
        {badge > 0 && <span className="m-badge">{badge > 99 ? '99+' : badge}</span>}
      </span>
      <span className="m-tab-label">{label}</span>
    </NavLink>
  );
}
