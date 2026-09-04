import { useState } from 'react';
import ProfitLoss from '../accounts/ProfitLoss';
import BalanceSheet from '../accounts/BalanceSheet';
import '../../components/MasterPage.css';
import '../../components/VoucherPage.css';

/**
 * The two statements on one screen.
 *
 * They are the same reports the Accounts menu serves — this page is the
 * reporting entry point to them, not a second implementation, so the numbers
 * cannot diverge from Accounts.
 */
export default function Financials() {
  const [tab, setTab] = useState('pl');

  return (
    <div>
      <div className="financial-tabs">
        <button className={tab === 'pl' ? 'financial-tab active' : 'financial-tab'}
                onClick={() => setTab('pl')}>
          Profit &amp; Loss
        </button>
        <button className={tab === 'bs' ? 'financial-tab active' : 'financial-tab'}
                onClick={() => setTab('bs')}>
          Balance Sheet
        </button>
      </div>
      {tab === 'pl' ? <ProfitLoss /> : <BalanceSheet />}
    </div>
  );
}
