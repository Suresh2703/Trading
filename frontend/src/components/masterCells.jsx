// Small presentational helpers shared by the master-data table configs.

export const statusCell = (row) => (
  <span className={row.is_active ? 'master-status active' : 'master-status inactive'}>
    {row.is_active ? 'Active' : 'Inactive'}
  </span>
);

export const badgeCell = (value, muted = false) => (
  value
    ? <span className={muted ? 'master-badge muted' : 'master-badge'}>{value}</span>
    : '-'
);

export const truncateCell = (value) => (
  <span className="master-truncate text-muted-small" title={value || ''}>
    {value || '-'}
  </span>
);

export const moneyCell = (value, symbol) => (
  <span className="price-tag">
    {symbol}{Number(value ?? 0).toFixed(2)}
  </span>
);

// Shared trailing field used by every master.
export const activeField = {
  key: 'is_active',
  label: 'Active',
  type: 'checkbox'
};
