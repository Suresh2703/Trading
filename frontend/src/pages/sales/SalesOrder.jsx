import { ClipboardList } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { salesDocumentsApi, customersApi } from '../../api';

const api = salesDocumentsApi('ORDER');

const config = {
  title: 'Sales Orders',
  subtitle: 'Confirmed customer orders, before anything ships.',
  singular: 'Sales Order',
  icon: ClipboardList,
  api,
  party: { key: 'customer', field: 'customer_id', label: 'Customer', api: customersApi },
  numberPlaceholder: 'SO-001'
  // No stock effect and nothing to raise it against yet (Quotation is disabled
  // in the sidebar), so no location or parent field.
};

export default function SalesOrder() {
  return <DocumentPage config={config} />;
}
