import { Monitor, Share, Smartphone, LogOut } from 'lucide-react';

import { useCurrency } from '../context/CurrencyContext';
import { usePermissions } from '../context/PermissionContext';
import { useInstallPrompt } from '../utils/pwa';
import { Screen } from './parts';

const CURRENCIES = [
  { code: 'USD', symbol: '$' }, { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' }, { code: 'INR', symbol: '₹' }
];

function signedInUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

/** Hold the desktop choice for this session, so `/` stops redirecting here. */
function preferDesktop() {
  try {
    sessionStorage.setItem('erp:prefer-desktop', '1');
  } catch {
    // Refused in private browsing; the link still opens the desktop view, and
    // on a phone the next visit to `/` simply comes back to the mobile app.
  }
}

export default function More({ onLogout }) {
  const { currency, updateCurrency } = useCurrency();
  const { roleName } = usePermissions();
  const { supported, installed, isIos, promptInstall } = useInstallPrompt();
  const user = signedInUser();

  return (
    <Screen title="More">
      <section className="m-card m-identity">
        <div className="m-avatar">{(user?.username || '?').charAt(0).toUpperCase()}</div>
        <div>
          <strong>{user?.username || 'Signed in'}</strong>
          <span className="m-muted">{roleName || user?.email || ''}</span>
        </div>
      </section>

      {/* Nothing to offer once it is already on the home screen. */}
      {!installed && (
        <section className="m-card">
          <h2 className="m-card-title"><Smartphone size={15} /> Install</h2>
          {supported ? (
            <>
              {/* Says only what it does: the app opens offline, the figures
                  in it do not. Promising cached figures here would be a
                  promise the worker no longer makes. */}
              <p className="m-muted">Add ERP Trading to your home screen and it opens
                 like any other app. It still needs a connection to show current
                 figures.</p>
              <button type="button" className="m-btn m-btn-primary"
                      onClick={promptInstall}>Add to home screen</button>
            </>
          ) : isIos ? (
            /* iOS has no programmatic install, so a button here could only
               fail; the Share sheet is the only route. */
            <p className="m-muted">
              Tap <Share size={13} style={{ verticalAlign: '-2px' }} /> Share in Safari,
              then <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="m-muted">
              Your browser will offer to install this app once you have used it
              a moment longer, or from its own menu.
            </p>
          )}
        </section>
      )}

      <section className="m-card">
        <h2 className="m-card-title">Currency</h2>
        <div className="m-choices">
          {CURRENCIES.map(({ code, symbol }) => (
            <button key={code} type="button"
                    className={currency === code ? 'is-active' : ''}
                    onClick={() => updateCurrency(code)}>
              {symbol} {code}
            </button>
          ))}
        </div>
      </section>

      <section className="m-card">
        <h2 className="m-card-title">Full application</h2>
        <p className="m-muted">Entering documents, masters and the ledger is on the
           desktop screens. They work here, but they are built for a wider window.</p>
        {/* A normal link, not a route change: the desktop shell must mount
            fresh rather than inside the mobile one. The flag stops App from
            sending a phone straight back here on arrival at `/`. */}
        <a className="m-btn" href="/" onClick={preferDesktop}>
          <Monitor size={15} /> Open the desktop view
        </a>
      </section>

      <button type="button" className="m-btn m-btn-danger" onClick={onLogout}>
        <LogOut size={15} /> Sign out
      </button>
    </Screen>
  );
}
