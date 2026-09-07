import { useState, useEffect } from 'react';
import { Search, Bell, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api';
import { usePermissions } from '../context/PermissionContext';
import './TopBar.css';

export default function TopBar({ onLogout, sidebarOpen, onToggleSidebar }) {
  // get user from local storage
  const user = JSON.parse(localStorage.getItem('user')) || { username: 'Admin', role: 'Super Admin' };

  const navigate = useNavigate();
  const { canView } = usePermissions();
  const [feed, setFeed] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);

  // The badge used to be a hardcoded 3. It now counts what is actually wrong,
  // recomputed from the books rather than stored, so it falls on its own once
  // the cause is dealt with.
  useEffect(() => {
    let cancelled = false;
    const load = () => notificationsApi.feed()
      .then((data) => { if (!cancelled) setFeed(data); })
      .catch(() => { /* signed out or offline: leave the bell quiet */ });
    load();
    const timer = setInterval(load, 120000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!showAlerts) return undefined;
    const close = (e) => {
      if (!e.target.closest('.topbar-alerts') && !e.target.closest('.alerts-btn')) {
        setShowAlerts(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showAlerts]);

  return (
    <header className="topbar glass-panel">
      <button className="icon-btn sidebar-toggle"
              onClick={onToggleSidebar}
              aria-label={sidebarOpen ? 'Hide menu' : 'Show menu'}
              aria-expanded={sidebarOpen}
              title={sidebarOpen ? 'Hide menu' : 'Show menu'}>
        {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
      </button>

      <div className="search-bar">
        <Search size={18} color="#888" />
        <input type="text" placeholder="Search across ERP..." />
      </div>
      
      <div className="topbar-actions">
        <div className="alerts-wrap">
          <button className="icon-btn alerts-btn"
                  aria-label={feed ? `${feed.count} alert(s)` : 'Alerts'}
                  onClick={() => setShowAlerts((s) => !s)}>
            <Bell size={20} />
            {feed && feed.count > 0 && (
              <span className={feed.danger ? 'badge danger' : 'badge'}>{feed.count}</span>
            )}
          </button>

          {showAlerts && (
            <div className="topbar-alerts glass-panel">
              <div className="alerts-head">
                <strong>Alerts</strong>
                <span className="text-muted-small">
                  {feed?.count ? `${feed.count} to look at` : 'nothing to report'}
                </span>
              </div>
              <div className="alerts-list">
                {(feed?.items || []).slice(0, 10).map((item, i) => (
                  <button className={`alert-row ${item.level}`} key={i}
                          onClick={() => {
                            setShowAlerts(false);
                            if (item.link) navigate(item.link);
                          }}>
                    <span className="alert-title">{item.title}</span>
                    <span className="alert-detail">{item.detail}</span>
                  </button>
                ))}
                {!feed?.count && (
                  <div className="alerts-empty">Nothing needs attention.</div>
                )}
              </div>
              {feed?.count > 10 && (
                <div className="alerts-more text-muted-small">
                  and {feed.count - 10} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Only shown to roles that can actually open it. The sidebar already
            hides its Settings link the same way; leaving the gear visible to
            everyone sent most roles to a "No access" panel, which reads as a
            broken button rather than a permission. */}
        {canView('SETTINGS') && (
          /* A real link rather than a button calling navigate(): it works
             without JavaScript having wired up, supports middle-click and
             open-in-new-tab, and shows its destination on hover — none of
             which a click handler gives. Every other navigation in the app is
             already a link. */
          <Link to="/settings" className="icon-btn" title="Settings" aria-label="Settings">
            <Settings size={20} />
          </Link>
        )}
        
        <div className="user-profile">
          <div className="avatar">{user.username.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">{user.username}</span>
            <span className="user-role">{user.role}</span>
          </div>
        </div>

        <button className="icon-btn logout-btn" onClick={onLogout} title="Log Out" style={{ marginLeft: '1rem', color: '#ef4444' }}>
          <LogOut size={20} />
        </button>
      </div>
    </header>
  )
}
