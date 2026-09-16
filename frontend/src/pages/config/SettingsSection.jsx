import { useState, useEffect } from 'react';
import { Save, RotateCcw, AlertTriangle, Check } from 'lucide-react';

import { settingsApi } from '../../api';

/**
 * One section of system configuration, rendered from what the server declares.
 *
 * The server sends each setting's type, bounds and default alongside its
 * value, so this does not carry a second copy of the rules that could drift
 * from the ones actually enforced. Adding a setting on the backend makes it
 * appear here with no change to this file.
 */
export default function SettingsSection({ section, title, blurb, canEdit, children }) {
  const [fields, setFields] = useState([]);
  const [draft, setDraft] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sections = await settingsApi.all();
      const mine = sections.find((s) => s.section === section);
      setFields(mine?.fields || []);
      setDraft(Object.fromEntries((mine?.fields || []).map((f) => [f.key, f.value])));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [section]);

  const setField = (key, value) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const isDirty = fields.some((f) => String(draft[f.key]) !== String(f.value));
  const atDefaults = fields.every((f) => String(draft[f.key]) === String(f.default));

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await settingsApi.saveSection(section, draft);
      setFields(updated.fields || []);
      setDraft(Object.fromEntries((updated.fields || []).map((f) => [f.key, f.value])));
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="cfg-loading">Loading settings...</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="cfg-head">
        <div>
          <h2 className="config-section-title">{title}</h2>
          {blurb && <p className="cfg-blurb">{blurb}</p>}
        </div>
      </div>

      {error && (
        <div className="cfg-error"><AlertTriangle size={15} /> {error}</div>
      )}
      {saved && (
        <div className="cfg-saved"><Check size={15} /> Saved. It applies from now on.</div>
      )}

      <div className="cfg-fields">
        {fields.map((field) => (
          <div className="cfg-field" key={field.key}>
            <div className="cfg-field-text">
              <label htmlFor={`set-${field.key}`}>{field.label}</label>
              {field.help && <span className="cfg-help">{field.help}</span>}
            </div>

            {field.type === 'bool' ? (
              <button type="button"
                      id={`set-${field.key}`}
                      role="switch"
                      aria-checked={Boolean(draft[field.key])}
                      disabled={!canEdit}
                      className={draft[field.key] ? 'cfg-switch on' : 'cfg-switch'}
                      onClick={() => setField(field.key, !draft[field.key])}>
                <span className="cfg-knob" />
              </button>
            ) : (
              <input id={`set-${field.key}`}
                     className="config-input cfg-number"
                     type="number"
                     disabled={!canEdit}
                     min={field.min} max={field.max}
                     value={draft[field.key] ?? ''}
                     onChange={(e) => setField(field.key, e.target.value === ''
                       ? '' : Number(e.target.value))} />
            )}
          </div>
        ))}
      </div>

      {children}

      {canEdit && (
        <div className="cfg-actions">
          <button className="btn-ghost"
                  disabled={atDefaults || isSaving}
                  onClick={() => {
                    setSaved(false);
                    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.default])));
                  }}>
            <RotateCcw size={15} /> Restore defaults
          </button>
          <button className="btn-primary" disabled={!isDirty || isSaving} onClick={save}>
            <Save size={15} /> {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}

      {!canEdit && (
        <div className="cfg-readonly">
          These are shown for reference. Only an administrator can change them.
        </div>
      )}
    </div>
  );
}
