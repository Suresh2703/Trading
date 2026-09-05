import { ShieldX } from 'lucide-react';
import { usePermissions } from '../context/PermissionContext';
import './MasterPage.css';

/**
 * Wraps a route in its module permission.
 *
 * Hiding a menu entry stops people stumbling into a page; it does not stop
 * someone typing the URL. The server would refuse the data anyway, but the
 * result would be a screen full of failed requests rather than a clear answer.
 */
export default function RequireModule({ module, children }) {
  const { canView, isLoading, role } = usePermissions();

  if (isLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Checking access...
      </div>
    );
  }

  if (!canView(module)) {
    return (
      <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <div className="master-modal-icon" style={{ margin: '0 auto 1rem' }}>
          <ShieldX size={22} />
        </div>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>No access</h2>
        <p className="text-muted-small" style={{ maxWidth: '420px', margin: '0 auto' }}>
          Your role{role ? ` (${role})` : ''} does not include
          {' '}<strong>{module.replace(/_/g, ' ').toLowerCase()}</strong>.
          An administrator can grant it from Roles &amp; Permissions.
        </p>
      </div>
    );
  }

  return children;
}
