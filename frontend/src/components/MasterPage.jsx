import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, X, AlertTriangle, Lock } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import './MasterPage.css';

/**
 * Config-driven CRUD screen shared by every master-data page.
 *
 * config = {
 *   title, subtitle, singular, icon, api, searchKeys,
 *   fields:  [{ key, label, type, required, placeholder, options, lookup, step, fullWidth }],
 *   columns: [{ key, label, align, render(row, ctx) }],
 *   summary: [{ label, icon, color, value(rows, ctx) }],
 *   lookups: { categories: categoriesApi }   // fetched once, feeds `lookup` fields
 * }
 */
export default function MasterPage({ config }) {
  const {
    title, subtitle, icon: Icon, api, fields, columns,
    summary = [], searchKeys = ['name'], lookups = {}
  } = config;

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [lookupData, setLookupData] = useState({});

  const { symbol } = useCurrency();

  // A function rather than a memoised value so function defaults (e.g. today's
  // date) are evaluated each time the form is opened.
  const buildEmptyForm = useCallback(() => {
    const blank = {};
    fields.forEach(f => {
      if (f.defaultValue !== undefined) {
        // A function lets the default be evaluated per form open (e.g. today).
        blank[f.key] = typeof f.defaultValue === 'function'
          ? f.defaultValue()
          : f.defaultValue;
      } else {
        blank[f.key] = f.type === 'checkbox' ? true : '';
      }
    });
    return blank;
  }, [fields]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRows(await api.list());
    } catch (err) {
      setLoadError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // Resolve any foreign-key dropdown sources once per page.
  useEffect(() => {
    const names = Object.keys(lookups);
    if (names.length === 0) return;
    let cancelled = false;
    Promise.all(names.map(n => lookups[n].list().catch(() => [])))
      .then(results => {
        if (cancelled) return;
        const next = {};
        names.forEach((n, i) => { next[n] = results[i]; });
        setLookupData(next);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ctx = { symbol, lookups: lookupData };

  const openCreate = () => {
    setEditingId(null);
    setForm(buildEmptyForm());
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (row) => {
    // The mirror of transformPayload: rebuild any virtual fields from the row.
    const source = config.transformRow ? config.transformRow(row) : row;
    const next = {};
    fields.forEach(f => {
      const value = source[f.key];
      next[f.key] = value === null || value === undefined
        ? (f.type === 'checkbox' ? false : '')
        : value;
    });
    setEditingId(row.id);
    setForm(next);
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  const buildPayload = () => {
    const payload = {};
    fields.forEach(f => {
      const value = form[f.key];
      if (f.type === 'checkbox') {
        payload[f.key] = Boolean(value);
      } else if (value === '' || value === undefined) {
        // Send null so clearing an optional field actually clears it server-side,
        // unless the column is NOT NULL — then `emptyValue` supplies the blank.
        if (f.emptyValue !== undefined) payload[f.key] = f.emptyValue;
        else payload[f.key] = f.required ? '' : null;
      } else if (f.type === 'number' || f.lookup) {
        payload[f.key] = Number(value);
      } else {
        payload[f.key] = value;
      }
    });
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      // `transformPayload` lets a page expose form fields that are not columns
      // (the adjustment screen's location + direction map onto from/to_location).
      const payload = config.transformPayload
        ? config.transformPayload(buildPayload(), form)
        : buildPayload();
      if (editingId === null) {
        await api.create(payload);
      } else {
        await api.update(editingId, payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.remove(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setPendingDelete({ ...pendingDelete, error: err.message });
    }
  };

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(row =>
      // A search key may be a column name or a function, so rows can be matched
      // on nested values too (e.g. the product ticker on an opening-stock row).
      searchKeys.some(k => {
        const value = typeof k === 'function' ? k(row) : row[k];
        return String(value ?? '').toLowerCase().includes(term);
      })
    );
  }, [rows, search, searchKeys]);

  const renderField = (field) => {
    const value = form[field.key] ?? '';
    const common = {
      className: 'config-input',
      style: { width: '100%', marginTop: '0.25rem' },
      required: field.required,
      value,
      onChange: e => setForm({ ...form, [field.key]: e.target.value })
    };

    if (field.type === 'checkbox') {
      return (
        <label className="master-checkbox">
          <input
            type="checkbox"
            checked={Boolean(form[field.key])}
            onChange={e => setForm({ ...form, [field.key]: e.target.checked })}
          />
          <span>{field.label}</span>
        </label>
      );
    }

    if (field.type === 'select' || field.lookup) {
      const options = field.lookup
        ? (lookupData[field.lookup.from] || []).map(o => ({
            value: o[field.lookup.valueKey || 'id'],
            // `label` lets a lookup build a composite caption, e.g. "SKU — Name".
            label: field.lookup.label
              ? field.lookup.label(o)
              : o[field.lookup.labelKey || 'name']
          }))
        : field.options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));

      return (
        <select {...common}>
          <option value="">{field.placeholder || 'Select ' + field.label.toLowerCase()}</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          {...common}
          placeholder={field.placeholder}
          style={{ ...common.style, minHeight: '60px', resize: 'vertical' }}
        />
      );
    }

    return (
      <input
        {...common}
        type={field.type || 'text'}
        step={field.step}
        placeholder={field.placeholder}
        onChange={e => setForm({
          ...form,
          [field.key]: field.uppercase ? e.target.value.toUpperCase() : e.target.value
        })}
      />
    );
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="products-header">
        <div className="page-title">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="dashboard-controls">
          <div className="control-btn" style={{ background: 'transparent', padding: '0.25rem 0.5rem' }}>
            <Search size={16} color="#888" />
            <input
              type="text"
              placeholder={'Search ' + title.toLowerCase() + '...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', marginLeft: '0.5rem' }}
            />
          </div>
          {/* A read-only view (e.g. a ledger) offers no way in to the form. */}
          {!config.readOnly && (
            <button
              className="btn-primary"
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              onClick={() => (showForm ? closeForm() : openCreate())}
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? 'Cancel' : 'Add ' + config.singular}
            </button>
          )}
        </div>
      </div>

      {summary.length > 0 && (
        <div className="summary-cards">
          {summary.map((card, i) => {
            const CardIcon = card.icon || Icon;
            return (
              <div className="summary-card glass-panel" key={i}>
                <div className="summary-icon" style={{ background: card.color + '33', color: card.color }}>
                  <CardIcon size={24} />
                </div>
                <div>
                  <div className="text-muted-small">{card.label}</div>
                  <div className="big-number" style={{ fontSize: '1.5rem' }}>
                    {card.value(rows, ctx)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
            {editingId === null ? 'Create New ' + config.singular : 'Edit ' + config.singular}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="master-form-grid">
              {fields.map(field => (
                <div key={field.key} className={field.fullWidth ? 'master-field-full' : undefined}>
                  {field.type !== 'checkbox' && (
                    <label className="text-muted-small">
                      {field.label}{field.required ? ' *' : ''}
                    </label>
                  )}
                  {renderField(field)}
                </div>
              ))}
            </div>

            {formError && (
              <div className="master-error">
                <AlertTriangle size={16} /> {formError}
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 2rem' }} disabled={isSaving}>
                {isSaving ? 'Saving...' : (editingId === null ? 'Save' : 'Update')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                    {col.label}
                  </th>
                ))}
                {!config.readOnly && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={columns.length + (config.readOnly ? 0 : 1)} style={{ textAlign: 'center' }}>Loading...</td></tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={columns.length + (config.readOnly ? 0 : 1)} style={{ textAlign: 'center', color: '#f87171' }}>
                    {loadError}
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (config.readOnly ? 0 : 1)} style={{ textAlign: 'center' }}>
                    {search ? 'No matches for your search.' : 'No records yet. Add one above!'}
                  </td>
                </tr>
              ) : visibleRows.map(row => (
                <tr key={row.id}>
                  {columns.map(col => (
                    <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                      {col.render ? col.render(row, ctx) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                  {!config.readOnly && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {config.rowLocked && config.rowLocked(row) ? (
                      // Owned by another record, so editing here would be undone.
                      <span className="master-locked"
                            title={config.lockedHint ? config.lockedHint(row) : 'Managed elsewhere'}>
                        <Lock size={13} /> Auto
                      </span>
                    ) : (
                      <>
                        <button className="action-btn edit" onClick={() => openEdit(row)} title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button className="action-btn delete" onClick={() => setPendingDelete(row)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingDelete && (
        <div className="master-modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="master-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="master-modal-icon"><AlertTriangle size={22} /></div>
            <h3>Delete {config.singular.toLowerCase()}?</h3>
            <p className="text-muted-small">
              <strong>{
                config.rowLabel
                  ? config.rowLabel(pendingDelete)
                  : (pendingDelete.name || pendingDelete.ticker || '#' + pendingDelete.id)
              }</strong>
              {' '}will be permanently removed. This cannot be undone.
            </p>
            {pendingDelete.error && (
              <div className="master-error"><AlertTriangle size={16} /> {pendingDelete.error}</div>
            )}
            <div className="master-modal-actions">
              <button className="btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
