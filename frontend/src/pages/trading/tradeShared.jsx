// Fields and columns shared by the Buy, Sell and Transactions screens.
// All three are views over the same `trades` table.
import { productsApi } from '../../api';
import { badgeCell } from '../../components/masterCells';

export const today = () => new Date().toISOString().slice(0, 10);

export const tradeLookups = { products: productsApi };

export const tradeFields = (prefix) => [
  { key: 'trade_no', label: 'Trade No.', required: true, placeholder: `${prefix}-001`, uppercase: true },
  {
    key: 'product_id',
    label: 'Product',
    required: true,
    lookup: { from: 'products', valueKey: 'id', label: p => `${p.ticker} — ${p.name}` },
    placeholder: 'Select product'
  },
  { key: 'quantity', label: 'Quantity', type: 'number', step: '0.0001', required: true, placeholder: '0' },
  { key: 'price', label: 'Price per Unit', type: 'number', step: '0.01', required: true, placeholder: '0.00' },
  // Non-nullable float server-side, so a blank must become 0 rather than null.
  { key: 'fees', label: 'Fees / Brokerage', type: 'number', step: '0.01', placeholder: '0.00', emptyValue: 0 },
  { key: 'trade_date', label: 'Trade Date', type: 'date', required: true, defaultValue: today },
  { key: 'counterparty', label: 'Counterparty / Broker', placeholder: 'Optional' },
  { key: 'reference_no', label: 'Reference No.', placeholder: 'Contract note ref', uppercase: true },
  { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional notes', fullWidth: true }
];

export const tradeSearchKeys = [
  'trade_no', 'reference_no', 'counterparty', 'notes',
  r => r.product?.ticker,
  r => r.product?.name
];

export const productColumn = {
  key: 'product',
  label: 'Product',
  render: r => (
    <div>
      <div style={{ fontWeight: 600 }}>{r.product?.ticker || '-'}</div>
      <div className="text-muted-small">{r.product?.name || ''}</div>
    </div>
  )
};

export const tradeNoColumn = {
  key: 'trade_no',
  label: 'Trade No.',
  render: r => (
    <div>
      <div style={{ fontWeight: 600 }}>{r.trade_no}</div>
      {r.reference_no && <div className="text-muted-small">ref {r.reference_no}</div>}
    </div>
  )
};

export const quantityColumn = {
  key: 'quantity',
  label: 'Qty',
  align: 'right',
  render: r => (
    <span style={{ fontWeight: 600 }}>
      {Number(r.quantity ?? 0).toFixed(2)}
      <span className="text-muted-small"> {r.product?.unit?.abbreviation || ''}</span>
    </span>
  )
};

export const priceColumn = {
  key: 'price',
  label: 'Price',
  align: 'right',
  render: (r, ctx) => (
    <span className="text-muted-small">{ctx.symbol}{Number(r.price ?? 0).toFixed(2)}</span>
  )
};

export const feesColumn = {
  key: 'fees',
  label: 'Fees',
  align: 'right',
  render: (r, ctx) => (
    <span className="text-muted-small">{ctx.symbol}{Number(r.fees ?? 0).toFixed(2)}</span>
  )
};

// Net cash: a buy costs price x qty plus fees, a sell nets fees off.
export const netValueColumn = {
  key: 'net_value',
  label: 'Net Value',
  align: 'right',
  render: (r, ctx) => (
    <span className="price-tag">{ctx.symbol}{Number(r.net_value ?? 0).toFixed(2)}</span>
  )
};

export const counterpartyColumn = {
  key: 'counterparty',
  label: 'Counterparty',
  render: r => <span className="text-muted-small">{r.counterparty || '-'}</span>
};

export const dateColumn = {
  key: 'trade_date',
  label: 'Date',
  render: r => (
    <span className="text-muted-small" title={r.notes || ''}>{r.trade_date || '-'}</span>
  )
};

export const sideColumn = {
  key: 'side',
  label: 'Side',
  render: r => (
    <span className="master-badge" style={r.side === 'BUY'
      ? { background: 'rgba(16,185,129,0.15)', color: '#10b981', borderColor: 'rgba(16,185,129,0.35)' }
      : { background: 'rgba(248,113,113,0.12)', color: '#f87171', borderColor: 'rgba(248,113,113,0.35)' }}>
      {r.side}
    </span>
  )
};

// Realized profit only exists on a sell — the FIFO pass fills it in server-side.
export const realizedColumn = {
  key: 'realized_pnl',
  label: 'Realized P&L',
  align: 'right',
  render: (r, ctx) => {
    if (r.side !== 'SELL' || r.realized_pnl === null || r.realized_pnl === undefined) {
      return <span className="text-muted-small">-</span>;
    }
    const positive = r.realized_pnl >= 0;
    return (
      <span style={{ fontWeight: 700, color: positive ? '#10b981' : '#f87171' }}>
        {positive ? '+' : '−'}{ctx.symbol}{Math.abs(r.realized_pnl).toFixed(2)}
      </span>
    );
  }
};

export const totalQty = rows => rows.reduce((a, r) => a + (r.quantity || 0), 0).toFixed(2);

export const totalNet = (rows, ctx) =>
  ctx.symbol + rows.reduce((a, r) => a + (r.net_value || 0), 0).toFixed(2);

export { badgeCell };
