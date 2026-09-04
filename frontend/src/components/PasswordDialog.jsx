import { useState } from 'react';
import { KeyRound, Eye, EyeOff, AlertTriangle, Check } from 'lucide-react';
import { passwordApi } from '../api';
import './MasterPage.css';
import '../pages/AuthUsers.css';

const MIN_LENGTH = 8;

/**
 * Sets a password, in one of two modes.
 *
 *   mode="self"  — your own account; asks for the current password
 *   mode="reset" — someone else's; an administrator override
 *
 * The confirmation field is checked here rather than server-side: mistyping a
 * password twice is a slip, not a rule the API needs to enforce.
 */
export default function PasswordDialog({ mode, user, onClose, onDone }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const isSelf = mode === 'self';
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = next.length >= MIN_LENGTH && next === confirm
    && (!isSelf || current.length > 0);

  const submit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      if (isSelf) await passwordApi.changeMine(current, next);
      else await passwordApi.resetFor(user.id, next);
      onDone(isSelf
        ? 'Password changed. Use it the next time you sign in.'
        : `Password reset for ${user.username}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const field = (label, value, setValue, autoComplete) => (
    <div className="pw-field">
      <label>{label}</label>
      <div className="pw-input-wrap">
        <input
          className="config-input"
          type={reveal ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={e => setValue(e.target.value)}
        />
        <button type="button" className="pw-reveal"
                onClick={() => setReveal(r => !r)}
                aria-label={reveal ? 'Hide passwords' : 'Show passwords'}>
          {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="master-modal-backdrop" onClick={onClose}>
      <div className="master-modal glass-panel pw-modal"
           style={{ textAlign: 'left' }}
           onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <KeyRound size={18} color="#8b5cf6" />
          <h3>{isSelf ? 'Change your password' : `Reset password`}</h3>
        </div>
        <p className="text-muted-small" style={{ margin: '0.15rem 0 0' }}>
          {isSelf
            ? 'You will need the new password the next time you sign in.'
            : `Setting a new password for ${user.username} (${user.email}). `
              + 'They are not told — pass it on yourself.'}
        </p>

        <form onSubmit={submit}>
          {isSelf && field('Current password', current, setCurrent, 'current-password')}
          {field('New password', next, setNext, 'new-password')}
          {field('Confirm new password', confirm, setConfirm, 'new-password')}

          {tooShort ? (
            <div className="pw-mismatch">
              At least {MIN_LENGTH} characters.
            </div>
          ) : mismatch ? (
            <div className="pw-mismatch">
              <AlertTriangle size={12} /> The two passwords do not match.
            </div>
          ) : next.length >= MIN_LENGTH && next === confirm ? (
            <div className="pw-hint" style={{ color: '#10b981' }}>
              <Check size={12} /> Passwords match.
            </div>
          ) : (
            <div className="pw-hint">At least {MIN_LENGTH} characters.</div>
          )}

          {error && (
            <div className="master-error"><AlertTriangle size={16} /> {error}</div>
          )}

          <div className="pw-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary"
                    disabled={!canSubmit || isSaving}>
              {isSaving ? 'Saving...' : (isSelf ? 'Change password' : 'Reset password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
