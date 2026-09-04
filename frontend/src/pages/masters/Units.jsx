import { Ruler, CheckCircle2 } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { unitsApi } from '../../api';
import { statusCell, badgeCell, activeField } from '../../components/masterCells';

const config = {
  title: 'Units',
  subtitle: 'Units of measure used for stock, purchases and sales.',
  singular: 'Unit',
  icon: Ruler,
  api: unitsApi,
  searchKeys: ['name', 'abbreviation'],

  fields: [
    { key: 'name', label: 'Unit Name', required: true, placeholder: 'e.g. Kilograms' },
    { key: 'abbreviation', label: 'Abbreviation', required: true, placeholder: 'e.g. kg' },
    activeField
  ],

  columns: [
    { key: 'name', label: 'Unit Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'abbreviation', label: 'Abbreviation', render: r => badgeCell(r.abbreviation) },
    { key: 'is_active', label: 'Status', render: statusCell }
  ],

  summary: [
    { label: 'Total Units', icon: Ruler, color: '#f59e0b', value: rows => rows.length },
    { label: 'Active', icon: CheckCircle2, color: '#10b981', value: rows => rows.filter(r => r.is_active).length }
  ]
};

export default function Units() {
  return <MasterPage config={config} />;
}
