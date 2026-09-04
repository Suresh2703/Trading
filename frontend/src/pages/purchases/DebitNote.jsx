import { ReceiptText } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { purchaseDocumentsApi, suppliersApi } from '../../api';

const api = purchaseDocumentsApi('DEBIT_NOTE');

const config = {
  title: 'Debit Notes',
  subtitle: 'Money the supplier owes you back, against an invoice or a return.',
  singular: 'Debit Note',
  icon: ReceiptText,
  api,
  party: { key: 'supplier', field: 'supplier_id', label: 'Supplier', api: suppliersApi },
  numberPlaceholder: 'DN-001',
  // Financial only — the stock left on the purchase return, not here.
  parentType: 'INVOICE',
  parentLabel: 'Against Purchase Invoice'
};

export default function DebitNote() {
  return <DocumentPage config={config} />;
}
