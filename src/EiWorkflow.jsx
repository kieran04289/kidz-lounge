import { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';
import { canManage } from './roles';
import { DateField, dateToInputValue, formatSlotLabel } from './pages/SchedulePage';
import { eiInput, eiLabel } from './eiHubUi';
import { TONES, buttonStyle, choiceStyle } from './uiTokens';
import { Tag } from './dashboardUi';

// The EI child's workflow on the chart's Services tab (the "ei" feature;
// Kieran, Oct 2026; API routes/eiWorkflow.js, lib/eiLifecycle.js):
//   - EI intake: what a new child still needs, ticked from their records
//     (the case manager's "EI intake" task closes when it's all done);
//   - booked sessions that a mandate or authorization no longer covers;
//   - End EI services (the office): end date + reason, mandates end that
//     day, then the sessions booked after it to delete or end one by one.
// Nothing here changes a session by itself.
const MUTED = 'var(--brand-muted)';
const INK = 'var(--brand-ink)';
const LINE = 'var(--brand-line)';
const nice = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');

function Check({ done }) {
  return (
    <span aria-hidden="true" style={{
      width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${done ? '#6CE9A6' : 'var(--brand-border)'}`, background: done ? TONES.success.bg : 'white', color: TONES.success.fg,
    }}>
      {done && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>}
    </span>
  );
}

// One copy of a child's workflow for the chart (Oct 2026): the Overview and
// the Services tab both show it, and it's one of the heavier requests, so a
// second tab within 30 seconds reuses it. Any change on the chart (a
// mandate, End EI services) asks for a fresh one.
const WORKFLOW_TTL_MS = 30 * 1000;
const workflowCache = new Map(); // patient id -> { at, promise }
function loadWorkflow(patientId, { fresh = false } = {}) {
  const hit = workflowCache.get(patientId);
  if (!fresh && hit && Date.now() - hit.at < WORKFLOW_TTL_MS) return hit.promise;
  const promise = api.getEiWorkflow(patientId);
  workflowCache.set(patientId, { at: Date.now(), promise });
  promise.catch(() => workflowCache.delete(patientId));
  return promise;
}

const sessionLine = (s) => `${nice(s.date)} · ${formatSlotLabel(s.time)} · ${s.service} with ${s.provider}`;

// One booked session after EI ended: delete it, or end its weekly series.
function AfterRow({ s, endDate, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => { setBusy(true); setError(null); try { await fn(); onDone(); } catch (err) { setError(err.message); setBusy(false); } };
  const action = s.is_virtual
    ? ['End weekly series', () => api.endRecurringSeries(s.series_id, endDate)]
    : s.series_id ? ['Delete', () => api.markAppointmentDeleted(s.id)] : ['Delete', () => api.deleteAppointment(s.id)];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: `1px solid ${LINE}`, fontSize: 13, color: INK, flexWrap: 'wrap' }}>
      <span>{sessionLine(s)}{s.is_virtual ? ' (weekly)' : ''}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {error && <span role="alert" style={{ fontSize: 12, color: TONES.danger.fg }}>{error}</span>}
        <button type="button" disabled={busy} onClick={() => run(action[1])} style={buttonStyle('danger', { padding: '4px 10px', fontSize: 12.5 })}>{busy ? 'Working...' : action[0]}</button>
      </span>
    </div>
  );
}

function EndForm({ patient, reasons, onDone, onCancel }) {
  const [endDate, setEndDate] = useState(dateToInputValue(new Date()));
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [offProgram, setOffProgram] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    if (!reason) { setError('Choose why EI services are ending.'); return; }
    setBusy(true); setError(null);
    try { onDone(await api.endEiServices(patient.id, { end_date: endDate, reason, note, off_program: offProgram })); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div style={{ marginTop: 10, padding: 14, border: `1px solid ${LINE}`, borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <div>
          <span style={eiLabel}>Last day of EI services</span>
          <DateField value={endDate} onChange={setEndDate} floating ariaLabel="Last day of EI services" style={{ ...eiInput, width: 'auto', minWidth: 180 }} />
        </div>
      </div>
      <span style={eiLabel}>Why</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Object.entries(reasons).map(([k, label]) => <button key={k} type="button" aria-pressed={reason === k} onClick={() => setReason(k)} style={choiceStyle(reason === k)}>{label}</button>)}
      </div>
      <label htmlFor="ei-end-note" style={eiLabel}>Note{reason === 'other' ? '' : ' (optional)'}</label>
      <textarea id="ei-end-note" rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} style={{ ...eiInput, resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: INK, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={offProgram} onChange={e => setOffProgram(e.target.checked)} /> Also set the child Off Program
      </label>
      <p style={{ fontSize: 12.5, color: MUTED, margin: '0 0 10px' }}>The child's EI mandates end on this day and their case manager gets a close-out task. Sessions booked after it are listed next for you to remove; none are removed automatically.</p>
      {error && <p role="alert" style={{ fontSize: 12.5, color: TONES.danger.fg, margin: '0 0 8px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={busy} onClick={submit} style={buttonStyle('primary')}>{busy ? 'Saving...' : 'End EI services'}</button>
        <button type="button" disabled={busy} onClick={onCancel} style={buttonStyle('secondary')}>Cancel</button>
      </div>
    </div>
  );
}

export default function EiWorkflowCard({ patient, headerStyle, boxStyle, reloadKey = 0 }) {
  const { user } = useAuth();
  const office = canManage(user);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [ending, setEnding] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => {
    let alive = true;
    // A reload (a change made here or on the Services tab) is always fresh.
    loadWorkflow(patient.id, { fresh: reload + reloadKey > 0 })
      .then(d => { if (alive) { setData(d); setError(null); } })
      .catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [patient.id, reload, reloadKey]);
  if (error) return <p role="alert" style={{ fontSize: 13, color: TONES.danger.fg }}>{error}</p>;
  if (!data) return null;
  const intake = data.intake;
  const left = intake ? intake.items.filter(i => !i.done).length : 0;
  const d = data.discharge;
  return (
    <>
      {intake && !intake.complete && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <p style={headerStyle}>EI intake</p>
            <span style={{ fontSize: 13, color: MUTED }}>{intake.items.length - left} of {intake.items.length} done</span>
          </div>
          <div style={boxStyle}>
            {intake.items.map((i, n) => (
              <div key={i.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: n ? `1px solid ${LINE}` : 'none' }}>
                <Check done={i.done} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: INK, fontWeight: i.done ? 400 : 600 }}>{i.label}</div>
                  {i.detail && <div style={{ fontSize: 12.5, color: MUTED }}>{i.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data.outside.length > 0 && (
        <>
          <p style={headerStyle}>Booked sessions to check</p>
          <div style={boxStyle}>
            <p style={{ margin: '0 0 6px', fontSize: 12.5, color: MUTED }}>Booked in the next {data.lookahead_days} days without a mandate{office ? ' or authorization' : ''} covering them. Fix the mandate or authorization below, or change the session.</p>
            {data.outside.map(s => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: `1px solid ${LINE}`, fontSize: 13, color: INK, flexWrap: 'wrap' }}>
                <span>{sessionLine(s)}</span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{s.problems.map(p => <Tag key={p} tone="warning">{p}</Tag>)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {(d || office) && (
        <>
          <p style={headerStyle}>Discharge</p>
          <div style={boxStyle}>
            {d ? (
              <p style={{ margin: 0, fontSize: 13.5, color: INK }}>
                Ended {nice(d.end_date)} · {d.reason_label}{d.note ? ` · ${d.note}` : ''}
              </p>
            ) : !ending ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: MUTED }}>When this child's EI services end (aged out, withdrew, moved...), record it here.</span>
                <button type="button" onClick={() => setEnding(true)} style={buttonStyle('secondary')}>End EI services</button>
              </div>
            ) : null}
            {!d && ending && (
              <EndForm patient={patient} reasons={data.end_reasons} onCancel={() => setEnding(false)}
                onDone={(r) => { setEnding(false); setResult(r); setReload(n => n + 1); }} />
            )}
            {result && result.mandates_after.length > 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: TONES.warning.fg }}>
                Mandates starting after the end date were left as they are: {result.mandates_after.map(m => `${m.service} from ${nice(m.start_date)}`).join(', ')}. Remove them on the Services tab if they shouldn't run.
              </p>
            )}
            {d && office && data.after_discharge.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 2 }}>Still booked after {nice(d.end_date)} ({data.after_discharge.length})</div>
                {data.after_discharge.map(s => <AfterRow key={s.key} s={s} endDate={d.end_date} onDone={() => setReload(n => n + 1)} />)}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// The top of an EI child's Overview (Kieran, Oct 2026): what needs doing
// first, each line opening the tab where it's dealt with, then the current
// services. The banner above already shows the next appointment and IFSP
// dates, so they're not repeated.
export function EiOverview({ patient, headerStyle, boxStyle, formsToReview = 0, onOpenTab }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    loadWorkflow(patient.id).then(d => { if (alive) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, [patient.id]);
  if (!data) return null;
  const todo = [
    ...(data.todo || []),
    ...(formsToReview > 0 ? [{ key: 'forms', text: `${formsToReview} Power Form${formsToReview === 1 ? '' : 's'} to review`, tab: 'power-forms', severity: 'warning' }] : []),
  ];
  // Late = red, due = amber (the dots must read differently at a glance).
  const dot = { danger: TONES.danger.fg, warning: '#F79009' };
  return (
    <>
      <p style={headerStyle}>What needs doing</p>
      <div style={boxStyle}>
        {todo.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>Nothing waiting for this child.</p>}
        {todo.map((t, i) => (
          <button key={t.key} type="button" onClick={() => onOpenTab?.(t.tab)}
            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, textAlign: 'left', padding: '8px 0', border: 'none', borderTop: i ? `1px solid ${LINE}` : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: dot[t.severity] || dot.warning }} />
            <span style={{ flex: 1, fontSize: 13.5, color: INK }}>{t.text}</span>
            <span style={{ fontSize: 12.5, color: 'var(--brand-primary)', fontWeight: 600 }}>Open →</span>
          </button>
        ))}
      </div>
      <p style={headerStyle}>Current services</p>
      <div style={boxStyle}>
        {data.services.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: MUTED }}>No EI mandate in effect today.</p>}
        {data.services.map((s, i) => (
          <div key={s.service} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: i ? `1px solid ${LINE}` : 'none', fontSize: 13.5, color: INK, flexWrap: 'wrap' }}>
            <span><strong style={{ fontWeight: 600 }}>{s.service}</strong> · {s.mandate}{s.start_date ? ` since ${nice(s.start_date)}` : ''}</span>
            {'authorization' in s && (
              <span style={{ color: s.authorization ? MUTED : TONES.warning.fg, fontSize: 13 }}>
                {s.authorization ? `Auth ${s.authorization.number}${s.authorization.end_date ? ` to ${nice(s.authorization.end_date)}` : ''}` : 'No authorization covering today'}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
