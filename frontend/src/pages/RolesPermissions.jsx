import { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldCheck, Plus, X, Save, Trash2, AlertTriangle, Check, Lock, Users
} from 'lucide-react';
import { rolesApi } from '../api';
import { usePermissions } from '../context/PermissionContext';
import '../components/MasterPage.css';
import '../components/VoucherPage.css';
import './RolesPermissions.css';

const NONE = 'none';
const VIEW = 'view';
const EDIT = 'edit';

// One cell of the grid is a three-way choice, not two checkboxes: "edit but
// not view" is not a coherent state, so it should not be expressible.
const LEVELS = [
  { key: NONE, label: 'No access', short: '—' },
  { key: VIEW, label: 'View only', short: 'View' },
  { key: EDIT, label: 'View & edit', short: 'Edit' }
];

const levelOf = (perm) => (!perm ? NONE : perm.can_edit ? EDIT : perm.can_view ? VIEW : NONE);

export default function RolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [draft, setDraft] = useState({});        // roleId -> { module: level }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const [showNew, setShowNew] = useState(false);
  const [newRole, setNewRole] = useState({ code: '', name: '', description: '' });

  const { reload: reloadMine } = usePermissions();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [roleList, moduleList] = await Promise.all([
        rolesApi.list(), rolesApi.modules()
      ]);
      setRoles(roleList);
      setModules(moduleList);
      const next = {};
      roleList.forEach(r => {
        next[r.id] = {};
        moduleList.forEach(m => {
          next[r.id][m.code] = levelOf(r.permissions.find(p => p.module === m.code));
        });
      });
      setDraft(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 6000);
  };

  const setLevel = (roleId, moduleCode, level) =>
    setDraft(d => ({ ...d, [roleId]: { ...d[roleId], [moduleCode]: level } }));

  const isDirty = (role) => {
    const current = draft[role.id] || {};
    return modules.some(m =>
      current[m.code] !== levelOf(role.permissions.find(p => p.module === m.code)));
  };

  const save = async (role) => {
    setSavingId(role.id);
    setError(null);
    try {
      const permissions = modules.map(m => {
        const level = draft[role.id][m.code];
        return {
          module: m.code,
          can_view: level !== NONE,
          can_edit: level === EDIT
        };
      });
      await rolesApi.update(role.id, { permissions });
      flash(`${role.name} permissions saved.`);
      await load();
      // The signed-in user's own role may have just changed.
      reloadMine();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const createRole = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await rolesApi.create({ ...newRole, permissions: [] });
      setNewRole({ code: '', name: '', description: '' });
      setShowNew(false);
      flash('Role created. Grant it some modules below.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async () => {
    try {
      await rolesApi.remove(pendingDelete.id);
      setPendingDelete(null);
      flash('Role deleted.');
      await load();
    } catch (err) {
      setPendingDelete({ ...pendingDelete, error: err.message });
    }
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>Roles &amp; Permissions</h1>
          <p>Which menu sections each role can reach, and whether it can change them.</p>
        </div>
        <div className="dashboard-controls">
          <button className="btn-primary"
                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  onClick={() => setShowNew(!showNew)}>
            {showNew ? <X size={16} /> : <Plus size={16} />}
            {showNew ? 'Cancel' : 'New Role'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', marginBottom: '1rem' }}>
          <div className="master-error" style={{ marginTop: 0 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        </div>
      )}

      {notice && (
        <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', marginBottom: '1rem',
             display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
          <Check size={16} /> {notice}
        </div>
      )}

      {showNew && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>New Role</h2>
          <form onSubmit={createRole}>
            <div className="master-form-grid">
              <div>
                <label className="text-muted-small">Code *</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={newRole.code} placeholder="e.g. WAREHOUSE"
                       onChange={e => setNewRole({ ...newRole, code: e.target.value.toUpperCase() })} />
                <div className="pw-hint">Stored on user accounts, so it cannot be changed later.</div>
              </div>
              <div>
                <label className="text-muted-small">Name *</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       required value={newRole.name} placeholder="Warehouse Supervisor"
                       onChange={e => setNewRole({ ...newRole, name: e.target.value })} />
              </div>
              <div className="master-field-full">
                <label className="text-muted-small">Description</label>
                <input className="config-input" style={{ width: '100%', marginTop: '0.25rem' }}
                       value={newRole.description} placeholder="What this role is for"
                       onChange={e => setNewRole({ ...newRole, description: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create role</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      ) : roles.map(role => (
        <div className="glass-panel rp-role" key={role.id}>
          <div className="rp-role-head">
            <div>
              <div className="rp-role-title">
                {role.is_system ? <ShieldCheck size={16} color="#a78bfa" />
                                : <Shield size={16} color="#94a3b8" />}
                <span>{role.name}</span>
                <span className="role-badge">{role.code}</span>
                {role.is_system && <span className="role-badge admin">System</span>}
              </div>
              <div className="text-muted-small">
                {role.description || 'No description'}
                {' · '}
                <Users size={11} style={{ verticalAlign: '-1px' }} /> {role.user_count} user
                {role.user_count === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {role.is_system ? (
                <span className="master-locked" title="Full access by design, and not deletable">
                  <Lock size={13} /> Fixed
                </span>
              ) : (
                <>
                  <button className="btn-primary rp-save"
                          disabled={!isDirty(role) || savingId === role.id}
                          onClick={() => save(role)}>
                    <Save size={14} /> {savingId === role.id ? 'Saving...' : 'Save'}
                  </button>
                  <button className="action-btn delete"
                          title={role.user_count ? 'In use — reassign its users first' : 'Delete role'}
                          onClick={() => setPendingDelete(role)}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="rp-grid">
            {modules.map(m => {
              const level = role.is_system ? EDIT : (draft[role.id]?.[m.code] ?? NONE);
              return (
                <div className="rp-cell" key={m.code}>
                  <div className="rp-cell-label">{m.label}</div>
                  <div className="rp-levels">
                    {LEVELS.map(l => (
                      <button key={l.key} type="button"
                              disabled={role.is_system}
                              className={level === l.key ? `rp-level ${l.key} active` : 'rp-level'}
                              title={l.label}
                              onClick={() => setLevel(role.id, m.code, l.key)}>
                        {l.short}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {pendingDelete && (
        <div className="master-modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="master-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="master-modal-icon"><AlertTriangle size={22} /></div>
            <h3>Delete role?</h3>
            <p className="text-muted-small">
              <strong>{pendingDelete.name}</strong> ({pendingDelete.code}) will be removed.
            </p>
            {pendingDelete.error && (
              <div className="master-error"><AlertTriangle size={16} /> {pendingDelete.error}</div>
            )}
            <div className="master-modal-actions">
              <button className="btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={remove}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
