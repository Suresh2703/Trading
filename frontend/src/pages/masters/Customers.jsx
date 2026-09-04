import { Users, CheckCircle2, Wallet } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { customersApi } from '../../api';
import { statusCell, badgeCell, moneyCell, activeField } from '../../components/masterCells';

const config = {
  title: 'Customers',
  subtitle: 'Parties you sell to — billing details, GSTIN and credit limits.',
  singular: 'Customer',
  icon: Users,
  api: customersApi,
  searchKeys: ['name', 'code', 'email', 'phone', 'gstin', 'city'],

  fields: [
    { key: 'code', label: 'Customer Code', required: true, placeholder: 'e.g. CUST-001', uppercase: true },
    { key: 'name', label: 'Customer Name', required: true, placeholder: 'Acme Retail Pvt Ltd' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'billing@acme.com' },
    { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210' },
    { key: 'gstin', label: 'GSTIN', placeholder: '29ABCDE1234F1Z5', uppercase: true },
    { key: 'credit_limit', label: 'Credit Limit', type: 'number', step: '0.01', placeholder: '0.00' },
    { key: 'city', label: 'City', placeholder: 'Bengaluru' },
    { key: 'state', label: 'State', placeholder: 'Karnataka' },
    { key: 'country', label: 'Country', placeholder: 'India' },
    { key: 'address', label: 'Address', type: 'textarea', placeholder: 'Street, area, postal code', fullWidth: true },
    activeField
  ],

  columns: [
    { key: 'code', label: 'Code', render: r => badgeCell(r.code) },
    { key: 'name', label: 'Customer Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'contact', label: 'Contact', render: r => (
      <div className="text-muted-small">
        <div>{r.email || '-'}</div>
        <div>{r.phone || '-'}</div>
      </div>
    ) },
    { key: 'gstin', label: 'GSTIN', render: r => <span className="text-muted-small">{r.gstin || '-'}</span> },
    { key: 'city', label: 'Location', render: r => (
      <span className="text-muted-small">
        {[r.city, r.state].filter(Boolean).join(', ') || '-'}
      </span>
    ) },
    { key: 'credit_limit', label: 'Credit Limit', align: 'right', render: (r, ctx) => moneyCell(r.credit_limit, ctx.symbol) },
    { key: 'is_active', label: 'Status', render: statusCell }
  ],

  summary: [
    { label: 'Total Customers', icon: Users, color: '#8b5cf6', value: rows => rows.length },
    { label: 'Active', icon: CheckCircle2, color: '#10b981', value: rows => rows.filter(r => r.is_active).length },
    {
      label: 'Total Credit Limit',
      icon: Wallet,
      color: '#f59e0b',
      value: (rows, ctx) =>
        ctx.symbol + rows.reduce((acc, r) => acc + (r.credit_limit || 0), 0).toFixed(2)
    }
  ]
};

export default function Customers() {
  return <MasterPage config={config} />;
}
