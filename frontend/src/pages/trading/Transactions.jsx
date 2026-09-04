import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import MasterPage from '../../components/MasterPage';
import { tradesApi } from '../../api';
import {
  tradeSearchKeys, tradeLookups,
  tradeNoColumn, sideColumn, productColumn, quantityColumn, priceColumn,
  feesColumn, netValueColumn, realizedColumn, dateColumn
} from './tradeShared';

// No side filter — this is the whole book.
const api = tradesApi(null);

const config = {
  title: 'Transactions',
  subtitle: 'Every trade in the book, newest first. Edit a trade from the Buy or Sell screen.',
  singular: 'Trade',
  icon: ArrowLeftRight,
  api,
  // A ledger: it reports the book rather than being the place you change it,
  // so no create form and no per-row actions.
  readOnly: true,
  lookups: tradeLookups,
  searchKeys: [...tradeSearchKeys, 'side'],
  fields: [],

  columns: [
    dateColumn, tradeNoColumn, sideColumn, productColumn,
    quantityColumn, priceColumn, feesColumn, netValueColumn, realizedColumn
  ],

  summary: [
    { label: 'Total Trades', icon: ArrowLeftRight, color: '#8b5cf6', value: rows => rows.length },
    {
      label: 'Buys',
      icon: TrendingUp,
      color: '#10b981',
      value: rows => rows.filter(r => r.side === 'BUY').length
    },
    {
      label: 'Sells',
      icon: TrendingDown,
      color: '#f87171',
      value: rows => rows.filter(r => r.side === 'SELL').length
    }
  ]
};

export default function Transactions() {
  return <MasterPage config={config} />;
}
