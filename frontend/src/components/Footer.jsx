import './Footer.css';

/**
 * The bottom rail of the app shell.
 *
 * Sits outside the scrolling area, so it stays visible while a long ledger
 * scrolls past it rather than being something you only reach at the end of a
 * report.
 */
export default function Footer() {
  const now = new Date();

  return (
    <footer className="app-footer glass-panel">
      <span className="footer-brand">
        &copy; {now.getFullYear()} ERP Trading
      </span>
      <span className="footer-meta">
        {now.toLocaleDateString(undefined, {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        })}
      </span>
    </footer>
  );
}
