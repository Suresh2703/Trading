import { Truck, CheckCircle2, FileText } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { suppliersApi } from '../../api';
import { statusCell, badgeCell, activeField } from '../../components/masterCells';

const PAYMENT_TERMS = ['Advance', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90', 'Cash on Delivery'];

const config = {
  title: 'Suppliers',
  subtitle: 'Parties you buy from — contact details, GSTIN and payment terms.',
  singular: 'Supplier',
  icon: Truck,
  api: suppliersApi,
  searchKeys: ['name', 'code', 'email', 'phone', 'gstin', 'city'],

  fields: [
    { key: 'code', label: 'Supplier Code', required: true, placeholder: 'e.g. SUP-001', uppercase: true },
    { key: 'name', label: 'Supplier Name', required: true, placeholder: 'Global Parts Ltd' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'sales@globalparts.com' },
    { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210' },
    { key: 'gstin', label: 'GSTIN', placeholder: '29ABCDE1234F1Z5', uppercase: true },
    { key: 'payment_terms', label: 'Payment Terms', type: 'select', options: PAYMENT_TERMS },
    { key: 'city', label: 'City', placeholder: 'Chennai' },
    { key: 'state', label: 'State', placeholder: 'Tamil Nadu' },
    { key: 'country', label: 'Country', placeholder: 'India' },
    { key: 'address', label: 'Address', type: 'textarea', placeholder: 'Street, area, postal code', fullWidth: true },
    activeField
  ],

  columns: [
    { key: 'code', label: 'Code', render: r => badgeCell(r.code) },
    { key: 'name', label: 'Supplier Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
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
    { key: 'payment_terms', label: 'Payment Terms', render: r => badgeCell(r.payment_terms, true) },
    { key: 'is_active', label: 'Status', render: statusCell }
  ],

  summary: [
    { label: 'Total Suppliers', icon: Truck, color: '#8b5cf6', value: rows => rows.length },
    { label: 'Active', icon: CheckCircle2, color: '#10b981', value: rows => rows.filter(r => r.is_active).length },
    {
      label: 'With GSTIN',
      icon: FileText,
      color: '#f59e0b',
      value: rows => rows.filter(r => r.gstin).length
    }
  ]
};

export default function Suppliers() {
  return <MasterPage config={config} />;
}
