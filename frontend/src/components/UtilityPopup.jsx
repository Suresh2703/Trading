import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import './UtilityPopup.css';

/**
 * The frame the keyboard-summoned utilities share.
 *
 * One shell rather than each utility rolling its own, so they close the same
 * way, trap focus the same way, and cannot drift apart visually. It also names
 * the shortcut in its header, which is the only place a keyboard-only feature
 * can be discovered.
 */
export default function UtilityPopup({
  open, title, icon: Icon, shortcut, onClose, children, headerExtra = null,
  size = 'wide'
}) {
  const panelRef = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    // Remember where focus was so closing returns it, rather than dumping the
    // user at the top of the document.
    restoreTo.current = document.activeElement;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      // Keep Tab inside the dialog: tabbing onto the page behind a modal moves
      // focus somewhere the user cannot see.
      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (restoreTo.current instanceof HTMLElement) restoreTo.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="util-backdrop" onClick={onClose}>
      <div ref={panelRef}
           className={`util-popup glass-panel util-${size}`}
           role="dialog"
           aria-modal="true"
           aria-label={title}
           onClick={(e) => e.stopPropagation()}>
        <header className="util-head">
          <h2>
            {Icon && <Icon size={17} />} {title}
            {shortcut && <span className="util-shortcut">{shortcut}</span>}
          </h2>
          <div className="util-head-right">
            {headerExtra}
            <button className="icon-btn" onClick={onClose} aria-label={`Close ${title}`}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="util-body">{children}</div>
      </div>
    </div>
  );
}
