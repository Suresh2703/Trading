import { Package, DollarSign, BarChart2, Tag } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { productsApi, categoriesApi, unitsApi } from '../../api';
import { badgeCell, truncateCell, moneyCell } from '../../components/masterCells';

const config = {
  title: 'Products Master',
  subtitle: 'Manage trading products, assets, and catalog items.',
  singular: 'Product',
  icon: Package,
  api: productsApi,
  searchKeys: ['name', 'ticker', 'description'],

  // Category and Unit are foreign keys, so their options come from the
  // /categories/ and /units/ masters rather than a hardcoded list.
  lookups: {
    categories: categoriesApi,
    units: unitsApi
  },

  fields: [
    { key: 'ticker', label: 'Ticker / SKU', required: true, placeholder: 'e.g. AAPL', uppercase: true },
    { key: 'name', label: 'Product Name', required: true, placeholder: 'Apple Inc.' },
    {
      key: 'category_id',
      label: 'Category',
      lookup: { from: 'categories', valueKey: 'id', labelKey: 'name' },
      placeholder: 'Select category'
    },
    {
      key: 'unit_id',
      label: 'Unit',
      lookup: { from: 'units', valueKey: 'id', labelKey: 'name' },
      placeholder: 'Select unit'
    },
    { key: 'current_price', label: 'Current Price', type: 'number', step: '0.01', required: true, placeholder: '0.00' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Short product description', fullWidth: true }
  ],

  columns: [
    {
      key: 'ticker',
      label: 'Ticker',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag size={14} color="#8b5cf6" />
          <span style={{ fontWeight: 600 }}>{r.ticker}</span>
        </div>
      )
    },
    { key: 'name', label: 'Product Name', render: r => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    // The API expands the FKs, so read the nested objects rather than the ids.
    { key: 'category', label: 'Category', render: r => badgeCell(r.category?.name) },
    {
      key: 'unit',
      label: 'Unit',
      render: r => (r.unit ? badgeCell(r.unit.abbreviation || r.unit.name, true) : '-')
    },
    { key: 'description', label: 'Description', render: r => truncateCell(r.description) },
    {
      key: 'current_price',
      label: 'Current Price',
      align: 'right',
      render: (r, ctx) => moneyCell(r.current_price, ctx.symbol)
    }
  ],

  summary: [
    { label: 'Total Products', icon: Package, color: '#8b5cf6', value: rows => rows.length },
    {
      label: 'Avg. Price',
      icon: DollarSign,
      color: '#10b981',
      value: (rows, ctx) => ctx.symbol + (
        rows.length
          ? (rows.reduce((acc, r) => acc + (r.current_price || 0), 0) / rows.length).toFixed(2)
          : '0.00'
      )
    },
    {
      label: 'Active Categories',
      icon: BarChart2,
      color: '#f59e0b',
      value: rows => new Set(rows.map(r => r.category?.name).filter(Boolean)).size
    }
  ]
};

export default function Products() {
  return <MasterPage config={config} />;
}
