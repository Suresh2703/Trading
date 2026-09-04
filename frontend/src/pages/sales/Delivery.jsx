import { Truck } from 'lucide-react';
import DocumentPage from '../../components/DocumentPage';
import { salesDocumentsApi, customersApi } from '../../api';

const api = salesDocumentsApi('DELIVERY');

const config = {
  title: 'Deliveries',
  subtitle: 'Goods shipped to customers. Saving one posts the stock out automatically.',
  singular: 'Delivery',
  icon: Truck,
  api,
  party: { key: 'customer', field: 'customer_id', label: 'Customer', api: customersApi },
  numberPlaceholder: 'DEL-001',
  // Moves stock, so it must say which location it ships from.
  needsLocation: true,
  parentType: 'ORDER',
  parentLabel: 'Against Sales Order'
};

export default function Delivery() {
  return <DocumentPage config={config} />;
}
