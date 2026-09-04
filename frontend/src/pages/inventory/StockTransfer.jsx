import { ArrowLeftRight, Package, MapPin } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { stockMovementsApi } from '../../api';
import {
  productField, quantityField, unitCostField, referenceField, dateField, remarksField,
  productColumn, quantityColumn, referenceColumn, dateColumn,
  baseSearchKeys, totalQty, warehouseField, warehouseCell, movementLookups
} from './movementShared';

const api = stockMovementsApi('TRANSFER');

const config = {
  title: 'Stock Transfer',
  subtitle: 'Move stock between locations. The total on hand does not change.',
  singular: 'Transfer',
  icon: ArrowLeftRight,
  api,

  searchKeys: [...baseSearchKeys, r => r.from_warehouse?.name, r => r.to_warehouse?.name],
  rowLabel: r => `${r.product?.ticker || '#' + r.id}: ${r.from_warehouse?.name || '?'} → ${r.to_warehouse?.name || '?'}`,

  lookups: movementLookups,

  fields: [
    productField,
    warehouseField('from_warehouse_id', 'From Warehouse'),
    warehouseField('to_warehouse_id', 'To Warehouse'),
    quantityField,
    unitCostField,
    referenceField,
    dateField,
    remarksField
  ],

  columns: [
    productColumn,
    {
      key: 'route',
      label: 'From → To',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {warehouseCell(r.from_warehouse, true)}
          <span className="text-muted-small">→</span>
          {warehouseCell(r.to_warehouse)}
        </div>
      )
    },
    quantityColumn,
    referenceColumn,
    dateColumn
  ],

  summary: [
    { label: 'Transfers', icon: ArrowLeftRight, color: '#8b5cf6', value: rows => rows.length },
    { label: 'Total Qty Moved', icon: Package, color: '#f59e0b', value: totalQty },
    {
      label: 'Warehouses Involved',
      icon: MapPin,
      color: '#10b981',
      value: rows => new Set(
        rows.flatMap(r => [r.from_warehouse?.name, r.to_warehouse?.name]).filter(Boolean)
      ).size
    }
  ]
};

export default function StockTransfer() {
  return <MasterPage config={config} />;
}
