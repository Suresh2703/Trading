import { Layers, CheckCircle2 } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { categoriesApi } from '../../api';
import { statusCell, truncateCell, activeField } from '../../components/masterCells';

const config = {
  title: 'Categories',
  subtitle: 'Group products into categories for reporting and classification.',
  singular: 'Category',
  icon: Layers,
  api: categoriesApi,
  searchKeys: ['name', 'description'],

  fields: [
    { key: 'name', label: 'Category Name', required: true, placeholder: 'e.g. Electronics' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What belongs in this category?', fullWidth: true },
    activeField
  ],

  columns: [
    { key: 'name', label: 'Category Name', render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'description', label: 'Description', render: r => truncateCell(r.description) },
    { key: 'is_active', label: 'Status', render: statusCell }
  ],

  summary: [
    { label: 'Total Categories', icon: Layers, color: '#8b5cf6', value: rows => rows.length },
    { label: 'Active', icon: CheckCircle2, color: '#10b981', value: rows => rows.filter(r => r.is_active).length }
  ]
};

export default function Categories() {
  return <MasterPage config={config} />;
}
