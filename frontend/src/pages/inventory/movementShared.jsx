// Fields and columns shared by the four stock-movement screens
// (Stock In, Stock Out, Stock Transfer, Stock Adjustment). Each screen is a
// view over the same stock_movements table, filtered by movement_type.
import { badgeCell } from '../../components/masterCells';
import { productsApi, warehousesApi } from '../../api';

export const today = () => new Date().toISOString().slice(0, 10);

// Warehouses are a master now, so every movement points at one by id.
export const movementLookups = { products: productsApi, warehouses: warehousesApi };

export const warehouseField = (key, label) => ({
  key,
  label,
  required: true,
  lookup: { from: 'warehouses', valueKey: 'id', label: w => `${w.code} — ${w.name}` },
  placeholder: 'Select warehouse'
});

export const warehouseCell = (warehouse, muted = false) =>
  badgeCell(warehouse?.name, muted);

export const productField = {
  key: 'product_id',
  label: 'Product',
  required: true,
  lookup: { from: 'products', valueKey: 'id', label: p => `${p.ticker} — ${p.name}` },
  placeholder: 'Select product'
};

export const quantityField = {
  key: 'quantity',
  label: 'Quantity',
  type: 'number',
  step: '0.01',
  required: true,
  placeholder: '0.00'
};

export const unitCostField = {
  key: 'unit_cost',
  label: 'Unit Cost',
  type: 'number',
  step: '0.01',
  placeholder: '0.00',
  // The column is a non-nullable float, so a blank cost means zero, not null.
  emptyValue: 0
};

export const referenceField = {
  key: 'reference_no',
  label: 'Reference No.',
  placeholder: 'e.g. GRN-001',
  uppercase: true
};

export const dateField = {
  key: 'movement_date',
  label: 'Date',
  type: 'date',
  required: true,
  defaultValue: today
};

export const remarksField = {
  key: 'remarks',
  label: 'Remarks',
  type: 'textarea',
  placeholder: 'Optional notes',
  fullWidth: true
};

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

export const valueColumn = {
  key: 'total_value',
  label: 'Value',
  align: 'right',
  render: (r, ctx) => (
    <span className="price-tag">
      {ctx.symbol}{Number(r.total_value ?? 0).toFixed(2)}
    </span>
  )
};

export const referenceColumn = {
  key: 'reference_no',
  label: 'Reference',
  render: r => badgeCell(r.reference_no, true)
};

export const dateColumn = {
  key: 'movement_date',
  label: 'Date',
  render: r => (
    <span className="text-muted-small" title={r.remarks || ''}>
      {r.movement_date || '-'}
    </span>
  )
};

// Shared search keys — every screen searches product, reference and remarks.
export const baseSearchKeys = [
  r => r.product?.ticker,
  r => r.product?.name,
  'reference_no',
  'remarks'
];

export const totalQty = rows => rows.reduce((acc, r) => acc + (r.quantity || 0), 0).toFixed(2);

export const totalValue = (rows, ctx) =>
  ctx.symbol + rows.reduce((acc, r) => acc + (r.total_value || 0), 0).toFixed(2);
