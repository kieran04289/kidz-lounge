import { useEffect, useId, useState } from 'react';
import { api } from './api';
import { DateField, dateToInputValue } from './pages/SchedulePage';
import { eiInput, eiLabel } from './eiHubUi';
import { TONES, buttonStyle, choiceStyle } from './uiTokens';
import { DISCIPLINES as SERVICES, DISCIPLINE_NAMES } from './disciplines';
import EiWorkflowCard from './EiWorkflow';

// The patient chart's Services tab (the "ei" feature, PedsDesk only; Kieran,
// Oct 2026; API routes/eiServices.js): an EI child's mandates and
// authorizations per service, with their dates, in one place.
//   - Update mandates: every service in one table, one "starts on" date, one
//     save (Kieran, Oct 2026: editing service by service was confusing). A
//     real change: each changed service's current mandate ends the day
//     before; earlier sessions keep it.
//   - Fix a mistake: corrects one entry in place, dates included. The entry
//     next to it moves to match.
//   - Authorizations: one table for all services (auth #, start and end,
//     Basic / Facility, visits). Entered here or imported from EI-Hub;
//     billing uses the one covering each session's date.
// The office edits everything; a provider corrects and changes mandates for
// their own services (never sees auth #s). The patient form's EI tab shows
// this read-only.

const MUTED = 'var(--brand-muted)';
const INK = 'var(--brand-ink)';
const LINE = 'var(--brand-line)';
const ACCENT = 'var(--brand-primary)';
const RED = TONES.danger.fg;
const GREEN = TONES.success.fg;
const linkButton = { background: 'none', border: 'none', padding: 0, color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const span = (start, end) => `${start ? fmt(start) : 'From the beginning'} – ${end ? fmt(end) : 'now'}`;

function MandateForm({ initial, showEnd, startRequired, hint, saveLabel, onSave, onCancel }) {
  const uid = useId();
  const [f, setF] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await onSave(f); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div style={{ padding: '10px 12px', margin: '6px 0', background: '#FAFAFA', border: `1px solid ${LINE}`, borderRadius: 6 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={eiLabel} htmlFor={`${uid}-sessions`}>Sessions a week</label>
          <input id={`${uid}-sessions`} value={f.sessions} onChange={e => setF({ ...f, sessions: e.target.value })} placeholder="2 or 1-2" style={{ ...eiInput, width: 90 }} />
        </div>
        <div>
          <label style={eiLabel} htmlFor={`${uid}-minutes`}>Minutes</label>
          <input id={`${uid}-minutes`} inputMode="numeric" value={f.minutes} onChange={e => setF({ ...f, minutes: e.target.value })} placeholder="30" style={{ ...eiInput, width: 80 }} />
        </div>
        <div>
          <span style={eiLabel}>Starts on</span>
          <DateField style={{ ...eiInput, width: 170 }} ariaLabel="Starts on" value={f.start_date || ''} clearable={!startRequired} placeholder={startRequired ? 'Select date' : 'From the beginning'} onChange={val => setF({ ...f, start_date: val || '' })} />
        </div>
        {showEnd && (
          <div>
            <span style={eiLabel}>Ends on</span>
            <DateField style={{ ...eiInput, width: 170 }} ariaLabel="Ends on" value={f.end_date || ''} onChange={val => setF({ ...f, end_date: val || '' })} />
          </div>
        )}
        <button type="button" disabled={busy || (startRequired && !f.start_date)} onClick={save} style={buttonStyle('primary')}>{saveLabel}</button>
        <button type="button" onClick={onCancel} style={buttonStyle('secondary')}>Cancel</button>
      </div>
      {hint && <p style={{ margin: '8px 0 0', fontSize: 12, color: MUTED }}>{hint}</p>}
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: RED }}>{error}</p>}
    </div>
  );
}

function AuthForm({ initial, isNew, services = [], onSave, onCancel }) {
  const uid = useId();
  const [f, setF] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await onSave(f); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div style={{ padding: '10px 12px', margin: '6px 0', background: '#FAFAFA', border: `1px solid ${LINE}`, borderRadius: 6 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {isNew && (
          <div>
            <span style={eiLabel}>Service</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {services.map(sv => <button key={sv} type="button" aria-pressed={f.service === sv} onClick={() => setF({ ...f, service: sv })} style={choiceStyle(f.service === sv)}>{sv}</button>)}
            </div>
          </div>
        )}
        {isNew && (
          <div>
            <label style={eiLabel} htmlFor={`${uid}-number`}>Auth #</label>
            <input id={`${uid}-number`} value={f.authorization_number} onChange={e => setF({ ...f, authorization_number: e.target.value })} style={{ ...eiInput, width: 130 }} />
          </div>
        )}
        <div>
          <span style={eiLabel}>Starts on</span>
          <DateField style={{ ...eiInput, width: 170 }} ariaLabel="Authorization starts on" value={f.start_date || ''} onChange={val => setF({ ...f, start_date: val || '' })} />
        </div>
        <div>
          <span style={eiLabel}>Ends on</span>
          <DateField style={{ ...eiInput, width: 170 }} ariaLabel="Authorization ends on" value={f.end_date || ''} onChange={val => setF({ ...f, end_date: val || '' })} />
        </div>
        <div>
          <span style={eiLabel}>Visit type</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['basic', 'Basic'], ['facility', 'Facility']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={f.visit_type === k} onClick={() => setF({ ...f, visit_type: f.visit_type === k ? '' : k })} style={choiceStyle(f.visit_type === k)}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={eiLabel} htmlFor={`${uid}-visits`}>Visits (optional)</label>
          <input id={`${uid}-visits`} inputMode="numeric" value={f.sessions_authorized ?? ''} onChange={e => setF({ ...f, sessions_authorized: e.target.value })} style={{ ...eiInput, width: 80 }} />
        </div>
        <button type="button" disabled={busy || !f.start_date || !f.end_date || (isNew && (!f.authorization_number.trim() || !f.service))} onClick={save} style={buttonStyle('primary')}>{isNew ? 'Add' : 'Save fix'}</button>
        <button type="button" onClick={onCancel} style={buttonStyle('secondary')}>Cancel</button>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: MUTED }}>Basic covers home and community visits, Facility visits at the agency. A child can hold both for one service at once.</p>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: RED }}>{error}</p>}
    </div>
  );
}

const mandateText = (m) => (m.sessions && m.minutes ? `${m.sessions} x ${m.minutes} min` : m.legacy_mandate ? `Old: ${m.legacy_mandate}` : '—');
const th = { textAlign: 'left', fontSize: 12, fontWeight: 500, color: MUTED, padding: '0 12px 8px 0', borderBottom: `1px solid ${LINE}` };
const td = { fontSize: 13.5, color: INK, padding: '9px 12px 9px 0', borderBottom: `1px solid ${LINE}`, verticalAlign: 'top' };

// Every service's new mandate in one go, from one date. Only rows whose
// numbers change are saved (API POST .../mandates/batch, all or nothing).
function UpdateMandates({ patientId, rows, onDone, onCancel }) {
  const [start, setStart] = useState('');
  const [values, setValues] = useState(() => Object.fromEntries(rows.map(r => [r.service, { sessions: r.current?.sessions || '', minutes: r.current?.minutes ? String(r.current.minutes) : '' }])));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const changed = rows.filter(r => {
    const v = values[r.service];
    if (!v.sessions && !v.minutes) return false;
    return !r.current || String(r.current.sessions) !== String(v.sessions).replace(/\s+/g, '') || String(r.current.minutes) !== String(v.minutes);
  });
  // A date is needed unless every changed service is getting its first
  // mandate (then it may be "from the beginning"); before anything changes,
  // ask for one.
  const needsDate = !changed.length || changed.some(r => r.hasAny);
  const save = async () => {
    setError(null);
    if (!changed.length) { setError('Change at least one service.'); return; }
    if (needsDate && !start) { setError('Choose the date the new mandates start.'); return; }
    setBusy(true);
    try {
      await api.saveEiMandates(patientId, { start_date: start || null, mandates: changed.map(r => ({ service: r.service, ...values[r.service] })) });
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  const set = (sv, k, val) => setValues(v => ({ ...v, [sv]: { ...v[sv], [k]: val } }));
  return (
    <div style={{ padding: 14, margin: '4px 0 10px', background: '#FAFAFA', border: `1px solid ${LINE}`, borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>Update mandates</div>
        <div>
          <span style={eiLabel}>New mandates start on</span>
          <DateField style={{ ...eiInput, width: 180 }} ariaLabel="New mandates start on" value={start} clearable={!needsDate}
            placeholder={needsDate ? 'Select date' : 'From the beginning'} onChange={val => setStart(val || '')} />
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Service</th><th style={th}>Now</th><th style={th}>New sessions a week</th><th style={th}>Minutes</th></tr></thead>
        <tbody>
          {rows.map(r => {
            const isChanged = changed.includes(r);
            return (
              <tr key={r.service}>
                <td style={{ ...td, fontWeight: 600 }}>{r.service} <span style={{ fontWeight: 400, color: MUTED }}>{DISCIPLINE_NAMES[r.service] || ''}</span></td>
                <td style={{ ...td, color: MUTED }}>{r.current ? mandateText(r.current) : 'None'}</td>
                <td style={td}><input aria-label={`${r.service} sessions a week`} value={values[r.service].sessions} onChange={e => set(r.service, 'sessions', e.target.value)} placeholder="2 or 1-2" style={{ ...eiInput, width: 90, borderColor: isChanged ? 'var(--brand-primary)' : undefined }} /></td>
                <td style={td}><input aria-label={`${r.service} minutes`} inputMode="numeric" value={values[r.service].minutes} onChange={e => set(r.service, 'minutes', e.target.value)} placeholder="30" style={{ ...eiInput, width: 80, borderColor: isChanged ? 'var(--brand-primary)' : undefined }} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ margin: '8px 0 0', fontSize: 12.5, color: MUTED }}>
        {changed.length ? `${changed.map(r => r.service).join(', ')} will change${start ? ` from ${fmt(start)}` : ''}; each one's current mandate ends the day before, and earlier sessions keep it.` : 'Change the numbers for any services that changed (e.g. at the IFSP review). Only changed rows are saved.'}
      </p>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: RED }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" disabled={busy} onClick={save} style={buttonStyle('primary')}>{busy ? 'Saving...' : 'Save changes'}</button>
        <button type="button" disabled={busy} onClick={onCancel} style={buttonStyle('secondary')}>Cancel</button>
      </div>
    </div>
  );
}

// One service's row in the mandates table, with its history and fixes.
function MandateRow({ patientId, s, data, onChanged }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null); // { kind: 'fix' | 'delete', item }
  const [error, setError] = useState(null);
  const current = s.mandates.find(m => m.current) || null;
  const done = () => { setForm(null); setError(null); onChanged(); };
  const remove = async (id) => { try { await api.deletePatientProgram(patientId, id); done(); } catch (err) { setError(err.message); } };
  return (
    <>
      <tr>
        <td style={{ ...td, fontWeight: 600 }}>{s.service} <span style={{ fontWeight: 400, color: MUTED }}>{DISCIPLINE_NAMES[s.service] || ''}</span></td>
        <td style={td}>{current ? mandateText(current) : <span style={{ color: MUTED }}>None now</span>}</td>
        <td style={{ ...td, color: MUTED }}>{current ? (current.start_date ? `Since ${fmt(current.start_date)}` : 'From the beginning') : ''}</td>
        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {s.mandates.length > 0 && <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ ...linkButton, color: MUTED, fontWeight: 500 }}>{open ? 'Hide history' : `History (${s.mandates.length})`}</button>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4} style={{ ...td, background: '#FAFAFA', padding: '6px 12px' }}>
            {error && <p role="alert" style={{ margin: '0 0 6px', fontSize: 13, color: RED }}>{error}</p>}
            {s.mandates.map(m => (
              <div key={m.id} style={{ borderTop: `1px solid ${LINE}`, padding: '6px 0' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                  <strong style={{ minWidth: 100 }}>{mandateText(m)}</strong>
                  <span>{span(m.start_date, m.end_date)}</span>
                  {m.current && <span style={{ color: GREEN }}>Current</span>}
                  {m.authorization_number && !s.authorizations.length && <span style={{ color: MUTED }}>Auth # {m.authorization_number} (no dates)</span>}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
                    {s.can_edit && <button type="button" onClick={() => setForm({ kind: 'fix', item: m })} style={linkButton}>Fix a mistake</button>}
                    {data.can_delete && (form?.kind === 'delete' && form.item.id === m.id ? (
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Delete this?
                        <button type="button" onClick={() => remove(m.id)} style={{ ...linkButton, color: RED }}>Delete</button>
                        <button type="button" onClick={() => setForm(null)} style={linkButton}>Keep</button>
                      </span>
                    ) : <button type="button" onClick={() => setForm({ kind: 'delete', item: m })} style={{ ...linkButton, color: MUTED }}>Delete</button>)}
                  </span>
                </div>
                {form?.kind === 'fix' && form.item.id === m.id && (
                  <MandateForm initial={{ sessions: m.sessions || '', minutes: m.minutes || '', start_date: m.start_date || '', end_date: m.end_date || '' }}
                    showEnd={!m.current} startRequired={false} saveLabel="Save fix"
                    hint="For an entry that was typed wrong: it's fixed as if it had been entered right. If its dates move, the entry next to it moves to match. For a real change, use Update mandates."
                    onCancel={() => setForm(null)}
                    onSave={(f) => api.correctEiMandate(patientId, m.id, { ...f, start_date: f.start_date || null }).then(done)} />
                )}
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

// Every authorization, all services, current first.
function AuthorizationsTable({ patientId, services, mandatedServices, today, onChanged }) {
  const [form, setForm] = useState(null); // { kind: 'new' | 'fix' | 'delete', item }
  const [error, setError] = useState(null);
  const done = () => { setForm(null); setError(null); onChanged(); };
  const state = (a) => (a.end_date < today ? 'Ended' : a.start_date > today ? 'Upcoming' : 'Current');
  const order = { Current: 0, Upcoming: 1, Ended: 2 };
  const all = services.flatMap(s => s.authorizations.map(a => ({ ...a, service: a.service || s.service })))
    .sort((x, y) => order[state(x)] - order[state(y)] || String(y.start_date).localeCompare(String(x.start_date)));
  const remove = async (n) => { try { await api.deleteEiAuthorization(patientId, n); done(); } catch (err) { setError(err.message); } };
  return (
    <>
      {error && <p role="alert" style={{ margin: '0 0 6px', fontSize: 13, color: RED }}>{error}</p>}
      {all.length === 0 && form?.kind !== 'new' && <p style={{ margin: 0, fontSize: 13, color: MUTED }}>None entered. Billing needs one covering each session's date.</p>}
      {all.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Service</th><th style={th}>Auth #</th><th style={th}>Dates</th><th style={th}>Type</th><th style={th}>Visits</th><th style={th}>Status</th><th style={th} /></tr></thead>
          <tbody>
            {all.map(a => {
              const st = state(a);
              return (
                <tr key={a.authorization_number}>
                  <td style={{ ...td, fontWeight: 600 }}>{a.service}</td>
                  <td style={td}>{a.authorization_number}<div style={{ fontSize: 12, color: MUTED }}>{a.by_hand ? 'Entered by hand' : 'From EI-Hub'}</div></td>
                  <td style={td}>{span(a.start_date, a.end_date)}</td>
                  <td style={td}>{a.visit_type ? (a.visit_type === 'basic' ? 'Basic' : 'Facility') : '—'}</td>
                  <td style={td}>{a.sessions_authorized !== null ? `${a.sessions_used ?? 0} of ${a.sessions_authorized}` : '—'}</td>
                  <td style={{ ...td, color: st === 'Current' ? GREEN : MUTED }}>{st}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {form?.kind === 'delete' && form.item.authorization_number === a.authorization_number ? (
                      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>Delete?
                        <button type="button" onClick={() => remove(a.authorization_number)} style={{ ...linkButton, color: RED }}>Delete</button>
                        <button type="button" onClick={() => setForm(null)} style={linkButton}>Keep</button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: 12 }}>
                        <button type="button" onClick={() => setForm({ kind: 'fix', item: a })} style={linkButton}>Fix a mistake</button>
                        {a.by_hand && <button type="button" onClick={() => setForm({ kind: 'delete', item: a })} style={{ ...linkButton, color: MUTED }}>Delete</button>}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {form?.kind === 'fix' && (
        <>
          <AuthForm initial={{ ...form.item, visit_type: form.item.visit_type || '' }} onCancel={() => setForm(null)}
            onSave={(f) => api.correctEiAuthorization(patientId, form.item.authorization_number, f).then(done)} />
          {!form.item.by_hand && <p style={{ margin: '0 0 6px', fontSize: 12, color: MUTED }}>This one came from EI-Hub: the next import will replace it with what EI-Hub has.</p>}
        </>
      )}
      {form?.kind === 'new' ? (
        <AuthForm isNew services={SERVICES} initial={{ service: mandatedServices.length === 1 ? mandatedServices[0] : '', authorization_number: '', start_date: '', end_date: '', visit_type: '', sessions_authorized: '' }}
          onCancel={() => setForm(null)} onSave={(f) => api.addEiAuthorization(patientId, f).then(done)} />
      ) : <button type="button" onClick={() => setForm({ kind: 'new' })} style={{ ...linkButton, marginTop: 8 }}>+ Add authorization</button>}
    </>
  );
}

export default function EiServicesTab({ patient, headerStyle, boxStyle }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    let alive = true;
    api.getEiServices(patient.id)
      .then(d => { if (alive) { setData(d); setError(null); } })
      .catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [patient.id, reload]);
  const today = dateToInputValue(new Date());
  const refresh = () => { setUpdating(false); setReload(n => n + 1); };
  const elsewhere = new Set((data?.elsewhere || []).map(e => e.service));
  // The rows Update mandates offers: every service this person may change
  // that isn't under another program right now.
  const bulkRows = data ? SERVICES.filter(sv => data.editable_services.includes(sv) && !elsewhere.has(sv)).map(sv => {
    const s = data.services.find(x => x.service === sv);
    return { service: sv, current: s?.mandates.find(m => m.current) || null, hasAny: !!(s && s.mandates.length) };
  }) : [];
  const mandated = (data?.services || []).filter(s => s.mandates.some(m => m.current)).map(s => s.service);
  return (
    <>
      {/* Order (Oct 2026): intake while it's unfinished, then the mandates and
          authorizations themselves, then what they leave uncovered, then discharge. */}
      <EiWorkflowCard patient={patient} headerStyle={headerStyle} boxStyle={boxStyle} reloadKey={reload} parts={['intake']} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <p style={headerStyle}>Mandates</p>
        {data && bulkRows.length > 0 && !updating && <button type="button" onClick={() => setUpdating(true)} style={linkButton}>Update mandates</button>}
      </div>
      <div style={boxStyle}>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: RED }}>{error}</p>}
        {!data && !error && <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Loading...</p>}
        {data && (
          <>
            {data.ei_without_mandate && (
              <p style={{ margin: '0 0 8px', fontSize: 13, color: MUTED }}>EI with no mandate per service yet{data.ei_without_mandate.legacy_mandate ? ` (old mandate: ${data.ei_without_mandate.legacy_mandate})` : ''}. Use Update mandates to enter each service's.</p>
            )}
            {data.elsewhere.length > 0 && (
              <p style={{ margin: '0 0 8px', fontSize: 13, color: MUTED }}>{data.elsewhere.map(e => `${e.service} is under ${e.program}`).join('; ')}. A service can only be under one program at a time: change that in the patient form.</p>
            )}
            {updating && <UpdateMandates patientId={patient.id} rows={bulkRows} onDone={refresh} onCancel={() => setUpdating(false)} />}
            {!data.services.length && !updating && <p style={{ margin: 0, fontSize: 13, color: MUTED }}>No EI mandates entered yet.</p>}
            {data.services.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Service</th><th style={th}>Mandate</th><th style={th}>Dates</th><th style={th} /></tr></thead>
                <tbody>{data.services.map(s => <MandateRow key={s.service} patientId={patient.id} s={s} data={data} onChanged={refresh} />)}</tbody>
              </table>
            )}
          </>
        )}
      </div>
      {data?.can_edit_authorizations && (
        <>
          <p style={headerStyle}>Authorizations</p>
          <div style={boxStyle}>
            <AuthorizationsTable patientId={patient.id} services={data.services} mandatedServices={mandated} today={today} onChanged={refresh} />
            <p style={{ margin: '10px 0 0', fontSize: 12, color: MUTED }}>Basic covers home and community visits, Facility visits at the agency. A child can hold both for one service at once.</p>
          </div>
        </>
      )}
      <EiWorkflowCard patient={patient} headerStyle={headerStyle} boxStyle={boxStyle} reloadKey={reload} parts={['checks', 'discharge']} />
    </>
  );
}
