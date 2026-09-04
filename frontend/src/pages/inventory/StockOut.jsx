import { ArrowUpFromLine, Package, Wallet } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { stockMovementsApi, customersApi } from '../../api';
import {
  productField, quantityField, unitCostField, referenceField, dateField, remarksField,
  productColumn, quantityColumn, valueColumn, referenceColumn, dateColumn,
  baseSearchKeys, totalQty, totalValue, warehouseField, warehouseCell, movementLookups
} from './movementShared';

const api = stockMovementsApi('OUT');

const config = {
  title: 'Stock Out',
  subtitle: 'Goods issued from a location — sales, consumption and write-offs.',
  singular: 'Stock Out',
  icon: ArrowUpFromLine,
  api,

  searchKeys: [...baseSearchKeys, r => r.from_warehouse?.name, r => r.customer?.name],
  rowLabel: r => `${r.product?.ticker || '#' + r.id} out of ${r.from_warehouse?.name || '?'}`,

  // Rows auto-posted by a Delivery or a Purchase Return belong to that document
  // — editing them here would just be overwritten on the document's next save.
  rowLocked: r => Boolean(r.source_document_id || r.source_purchase_id),
  lockedHint: r => `Posted automatically from ${r.source_purchase_id ? 'purchase return' : 'delivery'} `
    + `${r.reference_no}. Edit that document instead.`,

  lookups: { ...movementLookups, customers: customersApi },

  fields: [
    productField,
    warehouseField('from_warehouse_id', 'From Warehouse'),
    quantityField,
    unitCostField,
    {
      key: 'customer_id',
      label: 'Customer',
      lookup: { from: 'customers', valueKey: 'id', label: c => `${c.code} — ${c.name}` },
      placeholder: 'Select customer (optional)'
    },
    referenceField,
    dateField,
    remarksField
  ],

  columns: [
    productColumn,
    { key: 'from_warehouse', label: 'From Warehouse', render: r => warehouseCell(r.from_warehouse) },
    quantityColumn,
    valueColumn,
    { key: 'customer', label: 'Customer', render: r => <span className="text-muted-small">{r.customer?.name || '-'}</span> },
    referenceColumn,
    dateColumn
  ],

  summary: [
    { label: 'Issues', icon: ArrowUpFromLine, color: '#f87171', value: rows => rows.length },
    { label: 'Total Qty Out', icon: Package, color: '#8b5cf6', value: totalQty },
    { label: 'Total Value', icon: Wallet, color: '#f59e0b', value: totalValue }
  ]
};

export default function StockOut() {
  return <MasterPage config={config} />;
}
