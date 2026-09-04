import { FileText } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { purchaseDocumentsApi, suppliersApi } from '../../api';

const api = purchaseDocumentsApi('INVOICE');

const config = {
  title: 'Purchase Invoices',
  subtitle: 'What you owe the supplier. Raised against a receipt or an order.',
  singular: 'Purchase Invoice',
  icon: FileText,
  api,
  party: { key: 'supplier', field: 'supplier_id', label: 'Supplier', api: suppliersApi },
  numberPlaceholder: 'PINV-001',
  parentType: 'RECEIPT',
  parentLabel: 'Against Goods Receipt'
};

export default function PurchaseInvoice() {
  return <DocumentPage config={config} />;
}
