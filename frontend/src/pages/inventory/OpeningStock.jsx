import { Boxes, Warehouse, Wallet } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { openingStockApi, productsApi, warehousesApi } from '../../api';
import { statusCell, badgeCell, activeField } from '../../components/masterCells';

// Today in YYYY-MM-DD, which is what <input type="date"> expects.
const today = () => new Date().toISOString().slice(0, 10);

const config = {
  title: 'Opening Stock',
  subtitle: 'Stock already on hand when the books were opened, per product and location.',
  singular: 'Stock Entry',
  icon: Boxes,
  api: openingStockApi,

  // Rows key off a product, so let the search reach into the nested object.
  searchKeys: [
    r => r.product?.ticker,
    r => r.product?.name,
    r => r.warehouse?.name,
    'batch_no',
    'remarks'
  ],

  rowLabel: r => (r.product ? `${r.product.ticker} @ ${r.warehouse?.name || '?'}` : `#${r.id}`),

  lookups: { products: productsApi, warehouses: warehousesApi },

  fields: [
    {
      key: 'product_id',
      label: 'Product',
      required: true,
      lookup: {
        from: 'products',
        valueKey: 'id',
        label: p => `${p.ticker} — ${p.name}`
      },
      placeholder: 'Select product'
    },
    {
      key: 'warehouse_id',
      label: 'Warehouse',
      required: true,
      lookup: { from: 'warehouses', valueKey: 'id', label: w => `${w.code} — ${w.name}` },
      placeholder: 'Select warehouse'
    },
    // batch_no is NOT NULL server-side (it is part of the unique key), so a
    // blank must be sent as an empty string rather than null.
    { key: 'batch_no', label: 'Batch / Lot No.', placeholder: 'optional', uppercase: true, emptyValue: '' },
    { key: 'quantity', label: 'Quantity', type: 'number', step: '0.01', required: true, placeholder: '0.00' },
    { key: 'unit_cost', label: 'Unit Cost', type: 'number', step: '0.01', required: true, placeholder: '0.00' },
    { key: 'as_of_date', label: 'As of Date', type: 'date', required: true, defaultValue: today },
    { key: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'e.g. carried forward from previous financial year', fullWidth: true },
    activeField
  ],

  columns: [
    {
      key: 'product',
      label: 'Product',
      render: r => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.product?.ticker || '-'}</div>
          <div className="text-muted-small">{r.product?.name || ''}</div>
        </div>
      )
    },
    { key: 'warehouse', label: 'Warehouse', render: r => badgeCell(r.warehouse?.name) },
    { key: 'batch_no', label: 'Batch', render: r => badgeCell(r.batch_no, true) },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      render: r => (
        <span>
          {Number(r.quantity ?? 0).toFixed(2)}
          <span className="text-muted-small"> {r.product?.unit?.abbreviation || ''}</span>
        </span>
      )
    },
    {
      key: 'unit_cost',
      label: 'Unit Cost',
      align: 'right',
      render: (r, ctx) => (
        <span className="text-muted-small">
          {ctx.symbol}{Number(r.unit_cost ?? 0).toFixed(2)}
        </span>
      )
    },
    {
      // Derived server-side from quantity x unit_cost, so it can never drift.
      key: 'total_value',
      label: 'Total Value',
      align: 'right',
      render: (r, ctx) => (
        <span className="price-tag">
          {ctx.symbol}{Number(r.total_value ?? 0).toFixed(2)}
        </span>
      )
    },
    {
      key: 'as_of_date',
      label: 'As of',
      // Remarks are deliberately not a column — they are long and free-form, so
      // they live in the edit form and surface here as the row tooltip instead.
      render: r => (
        <span className="text-muted-small" title={r.remarks || ''}>
          {r.as_of_date || '-'}
        </span>
      )
    },
    { key: 'is_active', label: 'Status', render: statusCell }
  ],

  summary: [
    { label: 'Stock Entries', icon: Boxes, color: '#8b5cf6', value: rows => rows.length },
    {
      label: 'Warehouses',
      icon: Warehouse,
      color: '#f59e0b',
      value: rows => new Set(rows.map(r => r.warehouse?.name).filter(Boolean)).size
    },
    {
      label: 'Total Opening Value',
      icon: Wallet,
      color: '#10b981',
      value: (rows, ctx) =>
        ctx.symbol + rows.reduce((acc, r) => acc + (r.total_value || 0), 0).toFixed(2)
    }
  ]
};

export default function OpeningStock() {
  return <MasterPage config={config} />;
}
