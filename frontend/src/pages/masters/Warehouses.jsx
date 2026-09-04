import { Warehouse, CheckCircle2, Star } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { warehousesApi } from '../../api';
import { statusCell, badgeCell, activeField } from '../../components/masterCells';

const config = {
  title: 'Warehouses',
  subtitle: 'Places stock can sit. Every stock movement and document points at one of these.',
  singular: 'Warehouse',
  icon: Warehouse,
  api: warehousesApi,
  searchKeys: ['code', 'name', 'city', 'state', 'contact_person', 'phone'],
  rowLabel: r => `${r.code} — ${r.name}`,

  fields: [
    { key: 'code', label: 'Warehouse Code', required: true, placeholder: 'e.g. MAIN-STORE', uppercase: true },
    { key: 'name', label: 'Warehouse Name', required: true, placeholder: 'Main Store' },
    { key: 'contact_person', label: 'Contact Person', placeholder: 'Store keeper' },
    { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210' },
    { key: 'city', label: 'City', placeholder: 'Bengaluru' },
    { key: 'state', label: 'State', placeholder: 'Karnataka' },
    { key: 'address', label: 'Address', type: 'textarea', placeholder: 'Street, area, postal code', fullWidth: true },
    // The forms preselect this one, so new entries land somewhere sensible.
    { key: 'is_default', label: 'Default warehouse', type: 'checkbox' },
    activeField
  ],

  columns: [
    { key: 'code', label: 'Code', render: r => badgeCell(r.code) },
    {
      key: 'name',
      label: 'Warehouse Name',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontWeight: 600 }}>{r.name}</span>
          {r.is_default && <Star size={13} color="#f59e0b" fill="#f59e0b" />}
        </div>
      )
    },
    { key: 'contact_person', label: 'Contact', render: r => (
      <div className="text-muted-small">
        <div>{r.contact_person || '-'}</div>
        <div>{r.phone || ''}</div>
      </div>
    ) },
    { key: 'city', label: 'Location', render: r => (
      <span className="text-muted-small">
        {[r.city, r.state].filter(Boolean).join(', ') || '-'}
      </span>
    ) },
    { key: 'is_active', label: 'Status', render: statusCell }
  ],

  summary: [
    { label: 'Warehouses', icon: Warehouse, color: '#8b5cf6', value: rows => rows.length },
    { label: 'Active', icon: CheckCircle2, color: '#10b981', value: rows => rows.filter(r => r.is_active).length },
    {
      label: 'Default',
      icon: Star,
      color: '#f59e0b',
      value: rows => rows.find(r => r.is_default)?.name || 'None set'
    }
  ]
};

export default function Warehouses() {
  return <MasterPage config={config} />;
}
