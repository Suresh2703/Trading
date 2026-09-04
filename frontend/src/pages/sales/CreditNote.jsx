import { ReceiptText } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { salesDocumentsApi, customersApi } from '../../api';

const api = salesDocumentsApi('CREDIT_NOTE');

const config = {
  title: 'Credit Notes',
  subtitle: 'Money credited back to a customer, against an invoice or a return.',
  singular: 'Credit Note',
  icon: ReceiptText,
  api,
  party: { key: 'customer', field: 'customer_id', label: 'Customer', api: customersApi },
  numberPlaceholder: 'CN-001',
  // Financial only — the stock came back on the return, not here.
  parentType: 'INVOICE',
  parentLabel: 'Against Invoice'
};

export default function CreditNote() {
  return <DocumentPage config={config} />;
}
