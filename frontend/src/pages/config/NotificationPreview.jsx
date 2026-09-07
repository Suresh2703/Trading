import { useState, useEffect } from 'react';
import { Bell, RefreshCw, AlertTriangle, Info, AlertCircle } from 'lucide-react';

import { notificationsApi } from '../../api';

const ICONS = { danger: AlertCircle, warning: AlertTriangle, info: Info };

/**
 * What the current settings actually raise, right now.
 *
 * Thresholds are hard to choose in the abstract — "alert below 10" means
 * nothing until you can see it would fire on four products. Save the section
 * and refresh to see the effect.
 */
export default function NotificationPreview() {
  const [feed, setFeed] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setFeed(await notificationsApi.feed());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="cfg-preview">
      <div className="cfg-preview-head">
        <h3><Bell size={15} /> Alerts right now</h3>
        <button className="btn-ghost" onClick={load} disabled={isLoading}>
          <RefreshCw size={14} /> {isLoading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="cfg-error"><AlertTriangle size={15} /> {error}</div>}

      {feed && feed.count === 0 && (
        <div className="cfg-preview-empty">
          Nothing to report — the books are clean against these settings.
        </div>
      )}

      {feed && feed.count > 0 && (
        <ul className="cfg-preview-list">
          {feed.items.slice(0, 12).map((item, i) => {
            const Icon = ICONS[item.level] || Info;
            return (
              <li key={i} className={`cfg-alert ${item.level}`}>
                <Icon size={14} />
                <span>
                  <strong>{item.title}</strong> {item.detail}
                </span>
              </li>
            );
          })}
          {feed.count > 12 && (
            <li className="cfg-preview-more">and {feed.count - 12} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
