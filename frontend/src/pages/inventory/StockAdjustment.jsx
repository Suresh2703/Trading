import { SlidersHorizontal, TrendingUp, TrendingDown } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { stockMovementsApi } from '../../api';
import { badgeCell } from '../../components/masterCells';
import {
  productField, quantityField, unitCostField, referenceField, dateField, remarksField,
  productColumn, quantityColumn, referenceColumn, dateColumn,
  baseSearchKeys, warehouseField, warehouseCell, movementLookups
} from './movementShared';

const api = stockMovementsApi('ADJUSTMENT');

const INCREASE = 'INCREASE';
const DECREASE = 'DECREASE';

const REASONS = [
  'Count Correction',
  'Damaged',
  'Expired',
  'Lost / Theft',
  'Sample / Free Issue',
  'Return to Stock',
  'Other'
];

// An adjustment is stored like every other movement: direction is expressed by
// which warehouse column is set. The form asks the clearer question ("which
// warehouse, and up or down?") and these two hooks map between the two shapes.
const isIncrease = r => Boolean(r.to_warehouse_id);
const adjustedWarehouseId = r => r.to_warehouse_id || r.from_warehouse_id || '';
const adjustedWarehouse = r => r.to_warehouse || r.from_warehouse || null;

const config = {
  title: 'Stock Adjustment',
  subtitle: 'Correct on-hand quantities for damage, loss or a physical stock count.',
  singular: 'Adjustment',
  icon: SlidersHorizontal,
  api,

  searchKeys: [...baseSearchKeys, r => r.from_warehouse?.name, r => r.to_warehouse?.name, 'reason'],
  rowLabel: r => `${r.product?.ticker || '#' + r.id} @ ${adjustedWarehouse(r)?.name || '?'}`,

  lookups: movementLookups,

  transformPayload: (payload, form) => {
    const { warehouse_id, direction, ...rest } = payload;
    void warehouse_id; void direction;
    const target = form.warehouse_id ? Number(form.warehouse_id) : null;
    return {
      ...rest,
      to_warehouse_id: form.direction === INCREASE ? target : null,
      from_warehouse_id: form.direction === DECREASE ? target : null
    };
  },

  transformRow: (row) => ({
    ...row,
    warehouse_id: adjustedWarehouseId(row),
    direction: isIncrease(row) ? INCREASE : DECREASE
  }),

  fields: [
    productField,
    warehouseField('warehouse_id', 'Warehouse'),
    {
      key: 'direction',
      label: 'Adjustment',
      type: 'select',
      required: true,
      defaultValue: DECREASE,
      options: [
        { value: INCREASE, label: 'Increase (+) — found / over-counted' },
        { value: DECREASE, label: 'Decrease (−) — damaged / lost / short' }
      ]
    },
    quantityField,
    unitCostField,
    { key: 'reason', label: 'Reason', type: 'select', required: true, options: REASONS },
    referenceField,
    dateField,
    remarksField
  ],

  columns: [
    productColumn,
    { key: 'warehouse', label: 'Warehouse', render: r => warehouseCell(adjustedWarehouse(r)) },
    {
      key: 'direction',
      label: 'Adjustment',
      render: r => (
        <span className={isIncrease(r) ? 'master-status active' : 'master-status inactive'}
              style={isIncrease(r) ? undefined : { color: '#f87171' }}>
          {isIncrease(r) ? 'Increase' : 'Decrease'}
        </span>
      )
    },
    {
      ...quantityColumn,
      label: 'Qty',
      render: (r, ctx) => (
        <span style={{ fontWeight: 600, color: isIncrease(r) ? '#10b981' : '#f87171' }}>
          {isIncrease(r) ? '+' : '−'}{Number(r.quantity ?? 0).toFixed(2)}
          <span className="text-muted-small"> {r.product?.unit?.abbreviation || ''}</span>
        </span>
      )
    },
    { key: 'reason', label: 'Reason', render: r => badgeCell(r.reason, true) },
    referenceColumn,
    dateColumn
  ],

  summary: [
    { label: 'Adjustments', icon: SlidersHorizontal, color: '#8b5cf6', value: rows => rows.length },
    {
      label: 'Qty Increased',
      icon: TrendingUp,
      color: '#10b981',
      value: rows => rows.filter(isIncrease)
        .reduce((acc, r) => acc + (r.quantity || 0), 0).toFixed(2)
    },
    {
      label: 'Qty Decreased',
      icon: TrendingDown,
      color: '#f87171',
      value: rows => rows.filter(r => !isIncrease(r))
        .reduce((acc, r) => acc + (r.quantity || 0), 0).toFixed(2)
    }
  ]
};

export default function StockAdjustment() {
  return <MasterPage config={config} />;
}
