import { Undo2 } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { salesDocumentsApi, customersApi } from '../../api';

const api = salesDocumentsApi('RETURN');

const config = {
  title: 'Sales Returns',
  subtitle: 'Goods coming back from customers. Saving one posts the stock back in.',
  singular: 'Sales Return',
  icon: Undo2,
  api,
  party: { key: 'customer', field: 'customer_id', label: 'Customer', api: customersApi },
  numberPlaceholder: 'SR-001',
  // Moves stock back in, so it needs a receiving location.
  needsLocation: true,
  parentType: 'INVOICE',
  parentLabel: 'Against Invoice'
};

export default function SalesReturn() {
  return <DocumentPage config={config} />;
}
