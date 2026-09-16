import { AlertTriangle, BellOff, CircleAlert, Info, OctagonAlert } from 'lucide-react';

import { notificationsApi } from '../api';
import { useLiveData } from './useLiveData';
import { EmptyState, Freshness, Screen } from './parts';

const LEVEL = {
  danger: { icon: OctagonAlert, label: 'Urgent' },
  warning: { icon: CircleAlert, label: 'Watch' },
  info: { icon: Info, label: 'For information' }
};

const ORDER = ['danger', 'warning', 'info'];

/**
 * The same alerts as the desktop bell, grouped by how much they matter.
 *
 * They are derived from the books on every request rather than stored, so an
 * alert that has been dealt with is simply absent on the next pull — there is
 * nothing here to dismiss, and nothing that can linger after the fact.
 */
export default function Alerts() {
  const { data, error, loading, updatedAt, stale, reload } =
    useLiveData(() => notificationsApi.feed(), []);

  const groups = ORDER
    .map((level) => ({ level, items: (data?.items || []).filter((i) => i.level === level) }))
    .filter((g) => g.items.length > 0);

  return (
    <Screen title="Alerts"
            action={<Freshness at={updatedAt} stale={stale} busy={loading} onRefresh={reload} />}>
      {error && (
        <EmptyState icon={AlertTriangle} title="No connection" detail={error}
                    action={{ label: 'Try again', onClick: reload }} />
      )}

      {!data && loading && !error && (
        <div className="m-skeleton-list">{[0, 1, 2].map((i) => <div key={i} />)}</div>
      )}

      {data && groups.length === 0 && (
        <EmptyState icon={BellOff} title="Nothing needs attention"
                    detail="Stock, receivables and draft documents are all within their limits." />
      )}

      {groups.map(({ level, items }) => {
        const { icon: Icon, label } = LEVEL[level];
        return (
          <section key={level} className="m-card">
            <h2 className={`m-card-title m-level-${level}`}>
              <Icon size={15} /> {label} <span className="m-count">{items.length}</span>
            </h2>
            <ul className="m-alerts">
              {items.map((item, i) => (
                <li key={`${item.title}-${i}`} className={`m-alert m-alert-${level}`}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Screen>
  );
}
