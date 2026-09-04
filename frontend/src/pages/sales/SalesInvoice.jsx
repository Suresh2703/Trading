import { FileText } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { salesDocumentsApi, customersApi } from '../../api';

const api = salesDocumentsApi('INVOICE');

const config = {
  title: 'Sales Invoices',
  subtitle: 'What the customer owes. Raised against a delivery or an order.',
  singular: 'Sales Invoice',
  icon: FileText,
  api,
  party: { key: 'customer', field: 'customer_id', label: 'Customer', api: customersApi },
  numberPlaceholder: 'INV-001',
  parentType: 'DELIVERY',
  parentLabel: 'Against Delivery'
};

export default function SalesInvoice() {
  return <DocumentPage config={config} />;
}
