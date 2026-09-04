import { ClipboardList } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { purchaseDocumentsApi, suppliersApi } from '../../api';

const api = purchaseDocumentsApi('ORDER');

const config = {
  title: 'Purchase Orders',
  subtitle: 'What you have ordered from suppliers, before anything arrives.',
  singular: 'Purchase Order',
  icon: ClipboardList,
  api,
  party: { key: 'supplier', field: 'supplier_id', label: 'Supplier', api: suppliersApi },
  numberPlaceholder: 'PO-001'
};

export default function PurchaseOrder() {
  return <DocumentPage config={config} />;
}
