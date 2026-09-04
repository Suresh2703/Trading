import { Search, Bell, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import './TopBar.css';

export default function TopBar({ onLogout, sidebarOpen, onToggleSidebar }) {
  // get user from local storage
  const user = JSON.parse(localStorage.getItem('user')) || { username: 'Admin', role: 'Super Admin' };

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
        <button className="icon-btn">
          <Bell size={20} />
          <span className="badge">3</span>
        </button>
        <button className="icon-btn">
          <Settings size={20} />
        </button>
        
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
