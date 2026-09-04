import { ArrowDownToLine, Package, Wallet } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { stockMovementsApi, suppliersApi } from '../../api';
import {
  productField, quantityField, unitCostField, referenceField, dateField, remarksField,
  productColumn, quantityColumn, valueColumn, referenceColumn, dateColumn,
  baseSearchKeys, totalQty, totalValue, warehouseField, warehouseCell, movementLookups
} from './movementShared';

const api = stockMovementsApi('IN');

const config = {
  title: 'Stock In',
  subtitle: 'Goods received into a location — purchases, returns and production receipts.',
  singular: 'Stock In',
  icon: ArrowDownToLine,
  api,

  searchKeys: [...baseSearchKeys, r => r.to_warehouse?.name, r => r.supplier?.name],
  rowLabel: r => `${r.product?.ticker || '#' + r.id} into ${r.to_warehouse?.name || '?'}`,

  // Rows auto-posted by a Sales Return or a Goods Receipt belong to that document.
  rowLocked: r => Boolean(r.source_document_id || r.source_purchase_id),
  lockedHint: r => `Posted automatically from ${r.source_purchase_id ? 'goods receipt' : 'sales return'} `
    + `${r.reference_no}. Edit that document instead.`,

  lookups: { ...movementLookups, suppliers: suppliersApi },

  fields: [
    productField,
    warehouseField('to_warehouse_id', 'To Warehouse'),
    quantityField,
    unitCostField,
    {
      key: 'supplier_id',
      label: 'Supplier',
      lookup: { from: 'suppliers', valueKey: 'id', label: s => `${s.code} — ${s.name}` },
      placeholder: 'Select supplier (optional)'
    },
    referenceField,
    dateField,
    remarksField
  ],

  columns: [
    productColumn,
    { key: 'to_warehouse', label: 'To Warehouse', render: r => warehouseCell(r.to_warehouse) },
    quantityColumn,
    valueColumn,
    { key: 'supplier', label: 'Supplier', render: r => <span className="text-muted-small">{r.supplier?.name || '-'}</span> },
    referenceColumn,
    dateColumn
  ],

  summary: [
    { label: 'Receipts', icon: ArrowDownToLine, color: '#10b981', value: rows => rows.length },
    { label: 'Total Qty In', icon: Package, color: '#8b5cf6', value: totalQty },
    { label: 'Total Value', icon: Wallet, color: '#f59e0b', value: totalValue }
  ]
};

export default function StockIn() {
  return <MasterPage config={config} />;
}
