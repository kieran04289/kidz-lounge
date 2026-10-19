import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { Tag } from './dashboardUi';
import { INK, MUTED, HAIRLINE, NUMERIC, TONES, buttonStyle } from './uiTokens';
import { useStaffNames } from './staffDirectory';
import { ScheduleChangeForm } from './pages/ManageDataPage';
import { formatSlotLabel } from './pages/SchedulePage';
import Linkify from './Linkify';

// Contracted hours change requests (Kieran, Oct 2026; API
// routes/hoursRequests.js). A provider asks for new weekly hours from a date
// (optionally until one) on My time; an admin approves -- which schedules the
// change exactly as "+ Schedule a change" on the provider's profile does -- or
// denies it. Lunch, meetings and unavailable time need no approval, so they
// don't come here.

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const shortDate = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const range = (d) => `${formatSlotLabel(d.start_time.slice(0, 5))} – ${formatSlotLabel(d.end_time.slice(0, 5))}`;
const whenOf = (r) => (r.end_date ? `${shortDate(r.start_date)} – ${shortDate(r.end_date)} (temporary)` : `From ${shortDate(r.start_date)}`);
const STATUS = { pending: ['warning', 'Pending'], approved: ['success', 'Approved'], denied: ['danger', 'Denied'] };

// Weekday rows. With `before`, days that differ are marked so the admin
// sees what's actually changing.
function HoursTable({ schedule, before }) {
  const byDay = (list) => Object.fromEntries((list || []).map(d => [Number(d.weekday), d]));
  const now = byDay(schedule);
  const was = before ? byDay(before) : null;
  const days = ORDER.filter(wd => now[wd] || was?.[wd] || (wd !== 0 && wd !== 6));
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 12.5, ...NUMERIC }}>
      <tbody>
        {days.map(wd => {
          const text = now[wd] ? range(now[wd]) : 'Off';
          const oldText = was ? (was[wd] ? range(was[wd]) : 'Off') : null;
          const changed = was && oldText !== text;
          return (
            <tr key={wd}>
              <td style={{ padding: '2px 12px 2px 0', color: MUTED }}>{DAY[wd]}</td>
              {was && <td style={{ padding: '2px 8px 2px 0', color: MUTED, textDecoration: changed ? 'line-through' : 'none' }}>{oldText}</td>}
              {was && <td style={{ padding: '2px 8px 2px 0', color: MUTED }}>{changed ? '→' : ''}</td>}
              <td style={{ padding: '2px 0', color: INK, fontWeight: changed ? 600 : 400 }}>{was && !changed ? '' : text}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// My time's Contracted hours card: "Request a change", and the person's own
// requests that still matter (waiting, denied, or approved and not yet started).
export function MyHoursRequests({ providerName, onChanged }) {
  const [requests, setRequests] = useState(null);
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null); // id being withdrawn

  const load = useCallback(() => api.getHoursChangeRequests()
    .then(list => setRequests(list || []))
    .catch(() => setRequests([])), []);
  useEffect(() => { load(); }, [load]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const shown = (requests || []).filter(r => r.status !== 'approved' || String(r.start_date).slice(0, 10) >= todayStr);
  const hasPending = shown.some(r => r.status === 'pending');

  const submit = async (record) => {
    await api.requestHoursChange(record);
    setAsking(false);
    setNotice('Sent to the office for approval. Your hours stay as they are until it\'s approved.');
    load();
    onChanged?.();
  };
  const withdraw = async (r) => {
    setError(null);
    try { await api.withdrawHoursChange(r.id); setConfirming(null); setNotice(null); load(); onChanged?.(); } catch (err) { setError(err.message); }
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${HAIRLINE}` }}>
      {notice && <p role="status" style={{ fontSize: 12.5, color: TONES.success.fg, margin: '0 0 8px' }}>{notice}</p>}
      {error && <p role="alert" style={{ fontSize: 12.5, color: TONES.danger.fg, margin: '0 0 8px' }}>{error}</p>}
      {shown.map(r => {
        const [tone, label] = STATUS[r.status] || STATUS.pending;
        return (
          <div key={r.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>Hours change · {whenOf(r)}</span>
              <Tag tone={tone}>{label}</Tag>
            </div>
            <div style={{ marginTop: 4 }}><HoursTable schedule={r.schedule} /></div>
            {r.status === 'denied' && r.review_note && <p style={{ fontSize: 12.5, color: MUTED, margin: '4px 0 0' }}>Reason: <Linkify text={r.review_note} /></p>}
            {r.status !== 'approved' && (confirming === r.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12.5 }}>
                <span style={{ color: INK }}>{r.status === 'pending' ? 'Withdraw this request?' : 'Remove this?'}</span>
                <button type="button" onClick={() => withdraw(r)} style={buttonStyle('danger', { padding: '4px 10px', fontSize: 12.5 })}>{r.status === 'pending' ? 'Withdraw' : 'Remove'}</button>
                <button type="button" onClick={() => setConfirming(null)} style={buttonStyle('secondary', { padding: '4px 10px', fontSize: 12.5 })}>Keep</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(r.id)} style={buttonStyle('text', { fontSize: 12.5, padding: 0, marginTop: 4 })}>
                {r.status === 'pending' ? 'Withdraw' : 'Remove'}
              </button>
            ))}
          </div>
        );
      })}
      {asking ? (
        <ScheduleChangeForm providerName={providerName} onSubmit={submit} submitLabel="Send for approval" onCancel={() => setAsking(false)} />
      ) : !hasPending && requests !== null && (
        <button type="button" onClick={() => { setNotice(null); setAsking(true); }} style={buttonStyle('secondary', { fontSize: 12.5, padding: '5px 12px' })}>
          Request a change
        </button>
      )}
    </div>
  );
}

// Admin → Time off: every request waiting for a decision, with the hours in
// effect now beside the hours asked for. Renders nothing when none wait.
// `forUsername` narrows it to one person (their staff profile).
export function HoursRequestsAdmin({ forUsername, onChanged }) {
  const nameFor = useStaffNames();
  const [requests, setRequests] = useState([]);
  const [denying, setDenying] = useState(null);
  const [denyNote, setDenyNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => api.getHoursChangeRequests('pending')
    .then(list => setRequests((list || []).filter(r => !forUsername || r.username === forUsername)))
    .catch(() => setRequests([])), [forUsername]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); setDenying(null); setDenyNote(''); await load(); onChanged?.(); } catch (err) { setError(err.message); }
    setBusy(false);
  };

  if (!requests.length) return null;
  return (
    <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16, background: 'white' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 10 }}>
        Contracted hours requests <span style={{ color: MUTED, fontWeight: 400, ...NUMERIC }}>({requests.length})</span>
      </div>
      {error && <p role="alert" style={{ fontSize: 12.5, color: TONES.danger.fg, margin: '0 0 8px' }}>{error}</p>}
      {requests.map((r, i) => (
        <div key={r.id} style={{ padding: '10px 0', borderTop: i ? `1px solid ${HAIRLINE}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{nameFor(r.username)}</span>
            <span style={{ fontSize: 12.5, color: MUTED }}>{whenOf(r)} · asked {shortDate(r.requested_at)}</span>
          </div>
          <div style={{ marginTop: 6 }}><HoursTable schedule={r.schedule} before={r.current_schedule} /></div>
          {r.notes && <p style={{ fontSize: 12.5, color: INK, margin: '6px 0 0' }}><Linkify text={r.notes} /></p>}
          {denying === r.id ? (
            <div style={{ marginTop: 8, maxWidth: 420 }}>
              <label htmlFor={`kl-hours-deny-${r.id}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: INK, marginBottom: 4 }}>Reason (optional, they'll see it)</label>
              <textarea id={`kl-hours-deny-${r.id}`} rows={2} value={denyNote} onChange={e => setDenyNote(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: `1px solid ${HAIRLINE}`, fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" disabled={busy} onClick={() => act(() => api.denyHoursChange(r.id, denyNote))} style={buttonStyle('danger', { padding: '6px 12px', fontSize: 12.5 })}>Deny</button>
                <button type="button" disabled={busy} onClick={() => { setDenying(null); setDenyNote(''); }} style={buttonStyle('secondary', { padding: '6px 12px', fontSize: 12.5 })}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" disabled={busy} onClick={() => act(() => api.approveHoursChange(r.id))} style={buttonStyle('primary', { padding: '6px 12px', fontSize: 12.5 })}>Approve</button>
              <button type="button" disabled={busy} onClick={() => { setDenying(r.id); setDenyNote(''); }} style={buttonStyle('secondary', { padding: '6px 12px', fontSize: 12.5 })}>Deny</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
