import { useState } from 'react';

import './Logo.css';

/**
 * The application mark, from `public/logo.png`.
 *
 * Served as a file rather than inlined so replacing the logo is a matter of
 * dropping in a new `public/logo.png` — no code change, no rebuild of this
 * component. If that file is missing or will not decode, the wordmark stands
 * on its own rather than leaving a broken-image glyph in the corner of every
 * screen.
 */
export default function Logo({ size = 32, wordmark = null, className = '' }) {
  const [broken, setBroken] = useState(false);

  return (
    <span className={`app-logo ${className}`.trim()}>
      {!broken && (
        <img src="/logo.png"
             width={size}
             height={size}
             alt=""
             /* Decorative: the wordmark beside it already names the app, and
                in the rail the tooltip does. */
             aria-hidden="true"
             onError={() => setBroken(true)} />
      )}
      {wordmark && <span className="app-logo-word text-gradient">{wordmark}</span>}
    </span>
  );
}
