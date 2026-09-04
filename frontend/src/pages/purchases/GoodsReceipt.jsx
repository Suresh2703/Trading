import { PackageCheck } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { purchaseDocumentsApi, suppliersApi } from '../../api';

const api = purchaseDocumentsApi('RECEIPT');

const config = {
  title: 'Goods Receipts',
  subtitle: 'Goods arriving from suppliers. Saving one posts the stock in automatically.',
  singular: 'Goods Receipt',
  icon: PackageCheck,
  api,
  party: { key: 'supplier', field: 'supplier_id', label: 'Supplier', api: suppliersApi },
  numberPlaceholder: 'GRN-001',
  // Brings stock in, so it needs a receiving location.
  needsLocation: true,
  parentType: 'ORDER',
  parentLabel: 'Against Purchase Order'
};

export default function GoodsReceipt() {
  return <DocumentPage config={config} />;
}
