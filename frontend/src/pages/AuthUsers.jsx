import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserX, Search, Plus, Edit2, Trash2, Shield, KeyRound, Check } from 'lucide-react';
import { fetchUsers, createUser, roleApi } from '../api';
import PasswordDialog from '../components/PasswordDialog';
import './AuthUsers.css';

export default function AuthUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New user form state (hidden behind a simple toggle for now)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'USER' });

  // { mode: 'self' | 'reset', user }
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [notice, setNotice] = useState(null);
  const [createError, setCreateError] = useState(null);

  // Your own row gets the change form, everyone else's gets the admin reset.
  const signedIn = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  })();
  const signedInId = signedIn?.id ?? null;
  // Managing other accounts is an administrator action. The server enforces
  // this too — hiding the controls just avoids offering a dead end.
  const isAdmin = (signedIn?.role || 'USER').toUpperCase() === 'ADMIN';

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await fetchUsers();
    setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await createUser(newUser);
      setNewUser({ username: '', email: '', password: '', role: 'USER' });
      setCreateError(null);
      setShowAddForm(false);
      loadUsers(); // Refresh the list
    } catch (err) {
      setNotice(null);
      setCreateError(err.message);
    }
  };

  const changeRole = async (user, role) => {
    try {
      await roleApi.set(user.id, role);
      setNotice(`${user.username} is now ${role}.`);
      setTimeout(() => setNotice(null), 6000);
      loadUsers();
    } catch (err) {
      setNotice(null);
      setCreateError(err.message);
    }
  };

  const activeCount = users.filter(u => u.is_active).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      
      <div className="page-header">
        <div className="page-title">
          <h1>User Management</h1>
          <p>Manage system access, roles, and user profiles.</p>
        </div>
        <div className="dashboard-controls">
          <div className="control-btn" style={{ background: 'transparent', padding: '0.25rem 0.5rem' }}>
            <Search size={16} color="#888" />
            <input 
              type="text" 
              placeholder="Search users..." 
              style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', marginLeft: '0.5rem' }} 
            />
          </div>
          <button
            className="btn-ghost"
            style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}
            onClick={() => setPasswordTarget({
              mode: 'self',
              user: users.find(u => u.id === signedInId) || { id: signedInId }
            })}
            disabled={!signedInId}
          >
            <KeyRound size={16} /> Change My Password
          </button>
          {isAdmin && <button 
            className="btn-primary" 
            style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} /> {showAddForm ? 'Cancel' : 'Add New User'}
          </button>}
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card glass-panel">
          <div className="summary-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
            <Users size={24} />
          </div>
          <div>
            <div className="text-muted-small">Total Users</div>
            <div className="big-number" style={{fontSize: '1.5rem'}}>{users.length}</div>
          </div>
        </div>
        <div className="summary-card glass-panel">
          <div className="summary-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
            <UserCheck size={24} />
          </div>
          <div>
            <div className="text-muted-small">Active</div>
            <div className="big-number" style={{fontSize: '1.5rem'}}>{activeCount}</div>
          </div>
        </div>
        <div className="summary-card glass-panel">
          <div className="summary-icon" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
            <UserX size={24} />
          </div>
          <div>
            <div className="text-muted-small">Inactive</div>
            <div className="big-number" style={{fontSize: '1.5rem'}}>{inactiveCount}</div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Create New User</h2>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="text-muted-small">Username</label>
              <input 
                type="text" 
                required
                className="config-input" 
                style={{ width: '100%', marginTop: '0.25rem' }}
                value={newUser.username}
                onChange={e => setNewUser({...newUser, username: e.target.value})}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="text-muted-small">Email</label>
              <input 
                type="email" 
                required
                className="config-input" 
                style={{ width: '100%', marginTop: '0.25rem' }}
                value={newUser.email}
                onChange={e => setNewUser({...newUser, email: e.target.value})}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="text-muted-small">Password</label>
              <input 
                type="password" 
                required
                className="config-input" 
                style={{ width: '100%', marginTop: '0.25rem' }}
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
              />
            </div>
            <div>
              <label className="text-muted-small">Role</label>
              <select
                className="config-input"
                style={{ width: '100%', marginTop: '0.25rem' }}
                value={newUser.role}
                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="USER">USER — cannot manage accounts</option>
                <option value="ADMIN">ADMIN — can manage accounts</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" style={{ height: '42px', padding: '0 1.5rem' }}>
              Create
            </button>
          </form>
        </div>
      )}

      {createError && (
        <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', marginBottom: '1rem' }}>
          <div className="master-error" style={{ marginTop: 0 }}>
            <Shield size={16} /> {createError}
          </div>
        </div>
      )}

      {notice && (
        <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', marginBottom: '1rem',
                                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                                              color: '#10b981' }}>
          <Check size={16} /> {notice}
        </div>
      )}

      <div className="glass-panel">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{textAlign: 'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="4" style={{textAlign: 'center'}}>Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="4" style={{textAlign: 'center'}}>No users found. Create one!</td></tr>
              ) : users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{fontWeight: 600}}>{user.username}</div>
                    <div className="text-muted-small">{user.email}</div>
                  </td>
                  <td>
                    {isAdmin && user.id !== signedInId ? (
                      <select
                        className="config-input role-select"
                        value={user.role || 'USER'}
                        onChange={e => changeRole(user, e.target.value)}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="USER">USER</option>
                      </select>
                    ) : (
                      <span className={(user.role || 'USER') === 'ADMIN'
                        ? 'role-badge admin' : 'role-badge'}>
                        {user.role || 'USER'}
                        {user.id === signedInId && ' (you)'}
                      </span>
                    )}
                  </td>
                  <td>
                    {user.is_active ? (
                      <span className="tag-green">Active</span>
                    ) : (
                      <span className="tag-orange" style={{color: '#ef4444', background: 'rgba(239,68,68,0.2)'}}>Inactive</span>
                    )}
                  </td>
                  <td style={{textAlign: 'right'}}>
                    {(user.id === signedInId || isAdmin) && (
                      <button className="action-btn key"
                              title={user.id === signedInId
                                ? 'Change your password'
                                : `Reset password for ${user.username}`}
                              onClick={() => setPasswordTarget({
                                mode: user.id === signedInId ? 'self' : 'reset',
                                user
                              })}>
                        <KeyRound size={16} />
                      </button>
                    )}
                    <button className="action-btn edit"><Edit2 size={16} /></button>
                    <button className="action-btn delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {passwordTarget && (
        <PasswordDialog
          mode={passwordTarget.mode}
          user={passwordTarget.user}
          onClose={() => setPasswordTarget(null)}
          onDone={(message) => {
            setPasswordTarget(null);
            setNotice(message);
            // The banner is a confirmation, not a permanent state.
            setTimeout(() => setNotice(null), 6000);
          }}
        />
      )}

    </div>
  );
}
