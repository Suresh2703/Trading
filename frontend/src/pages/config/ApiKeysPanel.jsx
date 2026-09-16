import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Copy, Check, AlertTriangle, KeyRound, X, Power
} from 'lucide-react';

import { apiKeysApi, rolesApi } from '../../api';

const fmt = (value) => (value ? new Date(value).toLocaleDateString() : '—');

/**
 * Issuing and revoking API keys.
 *
 * The plain key exists only in the response that created it — the server keeps
 * a hash — so it is shown once, prominently, and cannot be recovered
 * afterwards. Saying so at the moment it is displayed is the difference
 * between a copied key and a support request.
 */
export default function ApiKeysPanel({ canEdit }) {
  const [keys, setKeys] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ name: '', role: 'VIEWER', expires_days: '' });
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setKeys(await apiKeysApi.list());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    rolesApi.list().then(setRoles).catch(() => { /* non-admins cannot list roles */ });
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const key = await apiKeysApi.create({
        name: draft.name,
        role: draft.role,
        expires_days: draft.expires_days === '' ? null : Number(draft.expires_days),
      });
      setIssued(key);
      setShowNew(false);
      setDraft({ name: '', role: 'VIEWER', expires_days: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (key) => {
    try {
      await apiKeysApi.update(key.id, { is_active: !key.is_active });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async () => {
    try {
      await apiKeysApi.remove(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setPendingDelete({ ...pendingDelete, error: err.message });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.plain_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('Could not reach the clipboard — select the key and copy it by hand.');
    }
  };

  return (
    <div className="cfg-keys">
      <div className="cfg-head">
        <div>
          <h2 className="config-section-title">API keys</h2>
          <p className="cfg-blurb">
            Let another system call this API. A key acts with the role you give
            it, so it can never do more than that role could.
          </p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => setShowNew(!showNew)}>
            {showNew ? <X size={15} /> : <Plus size={15} />}
            {showNew ? 'Cancel' : 'New key'}
          </button>
        )}
      </div>

      {error && <div className="cfg-error"><AlertTriangle size={15} /> {error}</div>}

      {issued && (
        <div className="cfg-issued">
          <div className="cfg-issued-head">
            <KeyRound size={16} />
            <strong>Copy this now — it cannot be shown again.</strong>
          </div>
          <p className="cfg-help">
            Only a hash is stored, so if this is lost the key has to be replaced.
          </p>
          <div className="cfg-issued-key">
            <code>{issued.plain_key}</code>
            <button className="btn-ghost" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="cfg-issued-use">
            Send it as the <code>X-API-Key</code> header on any request.
          </div>
          <button className="btn-ghost cfg-issued-done" onClick={() => setIssued(null)}>
            I have copied it
          </button>
        </div>
      )}

      {showNew && (
        <form className="cfg-newkey" onSubmit={create}>
          <div className="cfg-field">
            <div className="cfg-field-text">
              <label>Name</label>
              <span className="cfg-help">What uses this key — so it can be revoked knowingly.</span>
            </div>
            <input className="config-input" required value={draft.name}
                   placeholder="e.g. Warehouse scanner"
                   onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="cfg-field">
            <div className="cfg-field-text">
              <label>Acts as role</label>
              <span className="cfg-help">The key is held to this role&apos;s permissions.</span>
            </div>
            <select className="config-input" value={draft.role}
                    onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              {(roles.length ? roles : [{ code: 'VIEWER', name: 'Viewer' }])
                .filter((r) => r.is_active !== false)
                .map((r) => <option key={r.code} value={r.code}>{r.name || r.code}</option>)}
            </select>
          </div>
          <div className="cfg-field">
            <div className="cfg-field-text">
              <label>Expires in (days)</label>
              <span className="cfg-help">Blank uses the configured default; 0 never expires.</span>
            </div>
            <input className="config-input cfg-number" type="number" min="0"
                   value={draft.expires_days} placeholder="default"
                   onChange={(e) => setDraft({ ...draft, expires_days: e.target.value })} />
          </div>
          <div className="cfg-actions">
            <button type="submit" className="btn-primary">Generate key</button>
          </div>
        </form>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Key</th><th>Role</th><th>Expires</th>
              <th>Last used</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} style={{ textAlign: 'center' }}>Loading...</td></tr>
            )}
            {!isLoading && keys.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center' }}>
                No keys yet. Nothing outside the app can reach the API.
              </td></tr>
            )}
            {keys.map((key) => (
              <tr key={key.id}>
                <td><strong>{key.name}</strong></td>
                <td><code className="cfg-prefix">{key.key_prefix}…</code></td>
                <td><span className="role-badge">{key.role}</span></td>
                <td>{fmt(key.expires_at)}</td>
                <td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'never'}</td>
                <td>
                  <span className={key.is_active ? 'role-badge admin' : 'role-badge'}>
                    {key.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  {canEdit && (
                    <>
                      <button className="action-btn" title={key.is_active ? 'Disable' : 'Enable'}
                              onClick={() => toggle(key)}>
                        <Power size={15} />
                      </button>
                      <button className="action-btn delete" title="Delete permanently"
                              onClick={() => setPendingDelete(key)}>
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingDelete && (
        <div className="master-modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="master-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="master-modal-icon"><AlertTriangle size={22} /></div>
            <h3>Delete this key?</h3>
            <p className="text-muted-small">
              <strong>{pendingDelete.name}</strong> will stop working immediately,
              and anything using it will start failing. Disabling it instead is
              reversible.
            </p>
            {pendingDelete.error && (
              <div className="cfg-error"><AlertTriangle size={15} /> {pendingDelete.error}</div>
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
