import { Undo2 } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { purchaseDocumentsApi, suppliersApi } from '../../api';

const api = purchaseDocumentsApi('RETURN');

const config = {
  title: 'Purchase Returns',
  subtitle: 'Goods going back to the supplier. Saving one posts the stock out automatically.',
  singular: 'Purchase Return',
  icon: Undo2,
  api,
  party: { key: 'supplier', field: 'supplier_id', label: 'Supplier', api: suppliersApi },
  numberPlaceholder: 'PR-001',
  // Sends stock back out, so it needs a source location.
  needsLocation: true,
  parentType: 'RECEIPT',
  parentLabel: 'Against Goods Receipt'
};

export default function PurchaseReturn() {
  return <DocumentPage config={config} />;
}
