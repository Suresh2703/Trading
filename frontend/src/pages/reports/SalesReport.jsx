import DocumentReport from './DocumentReport';
import { reportsApi } from '../../api';

const config = {
  title: 'Sales Report',
  subtitle: 'Sales broken down by customer, product and month.',
  fetcher: reportsApi.sales,
  partyLabel: 'Customer',
  docTypes: ['INVOICE', 'ORDER', 'DELIVERY', 'RETURN', 'CREDIT_NOTE']
};

export default function SalesReport() {
  return <DocumentReport config={config} />;
}
