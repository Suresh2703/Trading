import { Percent, CheckCircle2, TrendingUp } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { taxesApi } from '../../api';
import { statusCell, badgeCell, truncateCell, activeField } from '../../components/masterCells';

const TAX_TYPES = ['GST', 'CGST', 'SGST', 'IGST', 'VAT', 'CESS'];

const config = {
  title: 'Tax / GST',
  subtitle: 'Tax rates applied to sales and purchase documents.',
  singular: 'Tax Rate',
  icon: Percent,
  api: taxesApi,
  searchKeys: ['name', 'tax_type', 'hsn_code', 'description'],

  fields: [
    { key: 'name', label: 'Tax Name', required: true, placeholder: 'e.g. GST 18%' },
    { key: 'tax_type', label: 'Tax Type', type: 'select', required: true, options: TAX_TYPES },
    { key: 'rate', label: 'Rate (%)', type: 'number', step: '0.01', required: true, placeholder: '18.00' },
    { key: 'hsn_code', label: 'HSN / SAC Code', placeholder: 'e.g. 8471', uppercase: true },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'When does this rate apply?', fullWidth: true },
    activeField
  ],

  columns: [
    { key: 'name', label: 'Tax Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'tax_type', label: 'Type', render: r => badgeCell(r.tax_type) },
    {
      key: 'rate',
      label: 'Rate',
      align: 'right',
      render: r => <span className="price-tag">{Number(r.rate ?? 0).toFixed(2)}%</span>
    },
    { key: 'hsn_code', label: 'HSN / SAC', render: r => badgeCell(r.hsn_code, true) },
    { key: 'description', label: 'Description', render: r => truncateCell(r.description) },
    { key: 'is_active', label: 'Status', render: statusCell }
  ],

  summary: [
    { label: 'Total Tax Rates', icon: Percent, color: '#8b5cf6', value: rows => rows.length },
    { label: 'Active', icon: CheckCircle2, color: '#10b981', value: rows => rows.filter(r => r.is_active).length },
    {
      label: 'Highest Rate',
      icon: TrendingUp,
      color: '#f59e0b',
      value: rows => (rows.length ? Math.max(...rows.map(r => r.rate || 0)).toFixed(2) + '%' : '0.00%')
    }
  ]
};

export default function Tax() {
  return <MasterPage config={config} />;
}
