import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './AuthContext';
import {
  AppointmentModal, CommentsThread, PatientDetailsPanel, DateField, TimeField, OffsiteSettingButtons, STATUS_OPTIONS, HOLD_STATUS, TREATMENT_AREA_OPTIONS,
  statusColor, formatSlotLabel, makeOffsiteArea, isHoldPatient, dateToInputValue, BRAND, BRAND_SERIF,
} from './pages/SchedulePage';
import { CENTER, settingOfArea, roomOfArea, offsiteLocation, areaAfterStatus } from './appointmentSetting';
import { collapseGroups, groupStatusText, MIN_CHILDREN, MAX_CHILDREN } from './groupClasses';
import { opensWindowForStatus } from './eiCancel';

// The group class window (src/groupClasses.js; Kieran, Nov 2026). With no
// `existing` it books a class: a name, the children, and the session as in
// the appointment window (provider, setting, date, time, length, repeat).
// With `existing` (a class card from collapseGroups) it shows that sitting
// the way the appointment window shows an appointment (GroupClassView): every
// child with their own status menu, Open (their own appointment window, for
// notes, why absent and make-ups), remove, add a child, the class's
// comments, rename and delete. A weekly class asks "Just this one" or "This
// & all future" for changes to the class.
//
// It reloads its own sitting after every change and tells the schedule
// (`onChanged`), so the card behind it stays in step.

const CLASS_MINUTES = [30, 45, 60, 90, 120];
// Read when used, not when this file loads: SchedulePage.jsx imports this
// file too, so its exports aren't ready yet at that point.
const childStatuses = () => STATUS_OPTIONS.filter(s => s !== HOLD_STATUS);
const hm = (t) => String(t || '').slice(0, 5);
const dateLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const addDays = (dateStr, n) => { const d = new Date(`${dateStr}T00:00:00`); d.setDate(d.getDate() + n); return dateToInputValue(d); };

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 };
const box = { background: 'white', borderRadius: 12, width: '100%', maxWidth: 620, maxHeight: '94vh', overflowY: 'auto', padding: '18px 22px', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' };
const input = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #e2e4e9', fontSize: 13.5, marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit' };
const label = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#374151' };
const panel = { border: '1px solid #e2e4e9', borderRadius: 8, padding: 12, marginBottom: 12 };
function btn(kind) {
  return {
    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    border: kind === 'primary' ? 'none' : kind === 'danger' ? '1px solid #dc2626' : '1px solid #e2e4e9',
    background: kind === 'primary' ? 'var(--brand-primary)' : kind === 'dangerSolid' ? '#A32D2D' : 'white',
    color: kind === 'primary' || kind === 'dangerSolid' ? 'white' : kind === 'danger' ? '#dc2626' : '#374151',
    ...(kind === 'dangerSolid' ? { border: 'none' } : {}),
  };
}
const linkBtn = { padding: 0, border: 'none', background: 'none', color: 'var(--brand-primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

// "One patient" / "Group class" at the top of the patient field, shared with
// the appointment window (SchedulePage.jsx).
export function BookingKindSwitch({ value, onChange }) {
  const opt = (v, text) => (
    <button
      type="button"
      onClick={() => value !== v && onChange(v)}
      aria-pressed={value === v}
      style={{
        border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        background: value === v ? 'white' : 'transparent', color: value === v ? '#111827' : '#6b7280',
        boxShadow: value === v ? '0 0 0 1px #e2e4e9' : 'none',
      }}
    >
      {text}
    </button>
  );
  return (
    <div role="group" aria-label="What to book" style={{ display: 'inline-flex', gap: 2, background: '#F1F2F4', borderRadius: 8, padding: 3, marginBottom: 12 }}>
      {opt('patient', 'One patient')}
      {opt('group', 'Group class')}
    </div>
  );
}

// Center (+ room) / School (+ name) / Home (+ optional place), stored the
// same way as an appointment's treatment_area.
// Until something is picked the stored value is kept exactly, so an older
// one ("Offsite: place") isn't lost by opening the fields.
function useSetting(initialArea) {
  const [touched, setTouched] = useState(false);
  const [setting, setSettingRaw] = useState(settingOfArea(initialArea || ''));
  const [room, setRoomRaw] = useState(roomOfArea(initialArea || ''));
  const [place, setPlaceRaw] = useState(offsiteLocation(initialArea || ''));
  const touch = (fn) => (v) => { setTouched(true); fn(v); };
  const setSetting = touch(setSettingRaw); const setRoom = touch(setRoomRaw); const setPlace = touch(setPlaceRaw);
  const area = !touched ? (initialArea || '') : setting === 'Center' ? (room || CENTER) : setting ? makeOffsiteArea(place, setting) : '';
  const buttons = <OffsiteSettingButtons value={setting} onChange={setSetting} />;
  const details = (
    <>
      {setting === 'Center' && (
        <div style={{ maxWidth: 260 }}>
          <label htmlFor="kl-group-room" style={label}>Room</label>
          <select id="kl-group-room" style={input} value={room} onChange={e => setRoom(e.target.value)}>
            <option value="">Not set yet</option>
            {TREATMENT_AREA_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            {room && !TREATMENT_AREA_OPTIONS.includes(room) && <option value={room}>{room}</option>}
          </select>
        </div>
      )}
      {(setting === 'School' || setting === 'Home') && (
        <>
          <label htmlFor="kl-group-place" style={label}>{setting === 'School' ? 'School name' : 'Home location (optional)'}</label>
          <input id="kl-group-place" style={input} value={place} onChange={e => setPlace(e.target.value)} placeholder={setting === 'School' ? 'e.g. Sunnyside Elementary' : ''} />
        </>
      )}
    </>
  );
  const fields = (
    <>
      <span style={{ ...label }}>Setting</span>
      <div style={{ marginBottom: 12 }}>{buttons}</div>
      {details}
    </>
  );
  return { area, touched, fields, buttons, details };
}

// Search for a child to add (the appointment window's patient search).
function ChildSearch({ exclude, onPick, disabled }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (!q.trim()) return undefined;
    const t = setTimeout(() => {
      api.searchPatients(q.trim()).then(r => setResults(r || [])).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const shown = q.trim() ? results.filter(p => !isHoldPatient(p) && !exclude.includes(p.Name)) : [];
  return (
    <div style={{ position: 'relative' }}>
      <input
        style={input}
        placeholder={disabled ? `Up to ${MAX_CHILDREN} children` : 'Search patients to add...'}
        value={q}
        disabled={disabled}
        onChange={e => setQ(e.target.value)}
        aria-label="Search patients to add"
      />
      {shown.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: `1.5px solid ${BRAND.box}`, borderRadius: 3, maxHeight: 180, overflowY: 'auto', zIndex: 10, marginTop: -12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {shown.map(p => (
            <div
              key={p.id}
              onClick={() => { onPick(p.Name); setQ(''); setResults([]); }}
              style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--brand-line)' }}
            >
              {p.Name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeChoice({ value, onChange, name }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, margin: '0 0 10px' }}>
      {[['one', 'This week only'], ['future', 'This & all future']].map(([v, text]) => (
        <label key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} /> {text}
        </label>
      ))}
    </div>
  );
}

export function GroupClassModal({ providers, existing, defaultDate, prefill, onClose, onSaved, onChanged, onSwitchToPatient }) {
  if (existing) return <GroupClassView providers={providers} existing={existing} onClose={onClose} onChanged={onChanged} />;
  return <NewGroupClass providers={providers} defaultDate={defaultDate} prefill={prefill} onClose={onClose} onSaved={onSaved} onSwitchToPatient={onSwitchToPatient} />;
}

function NewGroupClass({ providers, defaultDate, prefill, onClose, onSaved, onSwitchToPatient }) {
  const [name, setName] = useState('');
  const [children, setChildren] = useState([]);
  const [provider, setProvider] = useState(prefill?.provider || providers[0]?.Name || '');
  const [date, setDate] = useState(prefill?.date || dateToInputValue(defaultDate || new Date()));
  const [time, setTime] = useState(prefill?.time || '09:00');
  const [duration, setDuration] = useState(String(prefill?.duration || 60));
  const setting = useSetting(prefill?.treatmentArea || '');
  const [weekly, setWeekly] = useState(true);
  const [noEnd, setNoEnd] = useState(true);
  const [weeks, setWeeks] = useState('12');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!name.trim()) { setError('Give the class a name.'); return; }
    if (children.length < MIN_CHILDREN) { setError(`Add at least ${MIN_CHILDREN} children.`); return; }
    if (!provider || !date || !time) { setError('Provider, date and time are required.'); return; }
    const count = Math.max(1, parseInt(weeks, 10) || 1);
    setSaving(true); setError(null);
    try {
      await api.createGroupClass({
        name: name.trim(), provider, date, appointment_time: time, duration: Number(duration),
        treatment_area: setting.area || null, appointment_status: 'Scheduled', patients: children,
        weekly, end_date: weekly && !noEnd ? addDays(date, (count - 1) * 7) : null,
      });
      onSaved();
    } catch (err) {
      setSaving(false);
      setError(err.message);
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: BRAND_SERIF, fontSize: 19, fontWeight: 700, margin: '0 0 12px', color: '#111827' }}>New group class</h2>
        {onSwitchToPatient && <BookingKindSwitch value="group" onChange={() => onSwitchToPatient()} />}

        <label htmlFor="kl-group-name" style={label}>Class name *</label>
        <input id="kl-group-name" style={input} value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="e.g. Social skills group" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={label}>Children *</span>
          <span style={{ fontSize: 12, color: BRAND.muted }}>{children.length} of {MAX_CHILDREN}</span>
        </div>
        <ChildSearch exclude={children} disabled={children.length >= MAX_CHILDREN} onPick={(n) => setChildren(c => [...c, n])} />
        {children.length > 0 && (
          <div style={{ border: '1px solid #e2e4e9', borderRadius: 8, marginBottom: 12 }}>
            {children.map((c, i) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderTop: i ? '1px solid #f1f2f4' : 'none', fontSize: 13 }}>
                <span>{c}</span>
                <button type="button" onClick={() => setChildren(cs => cs.filter(x => x !== c))} aria-label={`Remove ${c}`} style={{ ...linkBtn, color: '#6b7280', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <label htmlFor="kl-group-provider" style={label}>Provider *</label>
        <select id="kl-group-provider" style={input} value={provider} onChange={e => setProvider(e.target.value)}>
          {providers.map(p => <option key={p.id} value={p.Name}>{p.Name}</option>)}
        </select>
        {setting.fields}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.8fr)', gap: '0 12px' }}>
          <DateField label="Date *" value={date} onChange={setDate} />
          <TimeField label="Time *" value={time} onChange={setTime} anyTime />
          <div>
            <label htmlFor="kl-group-minutes" style={label}>Minutes</label>
            <select id="kl-group-minutes" style={input} value={duration} onChange={e => setDuration(e.target.value)}>
              {CLASS_MINUTES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div style={panel}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
            <input type="checkbox" checked={weekly} onChange={e => setWeekly(e.target.checked)} />
            Repeat weekly
          </label>
          {weekly && (
            <div style={{ marginTop: 8, paddingLeft: 22 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={noEnd} onChange={e => setNoEnd(e.target.checked)} />
                No end date
              </label>
              {!noEnd && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 13, color: BRAND.muted }}>for</span>
                  <input type="number" min={1} max={52} value={weeks} onChange={e => setWeeks(e.target.value)} aria-label="Number of weeks"
                    style={{ width: 56, padding: '4px 6px', borderRadius: 3, border: `1.5px solid ${BRAND.box}`, fontSize: 13 }} />
                  <span style={{ fontSize: 13, color: BRAND.muted }}>weeks</span>
                </div>
              )}
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: BRAND.muted, margin: '0 0 12px' }}>Each child gets their own session, billed under their own program.</p>

        {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btn()}>Cancel</button>
          <button type="button" onClick={save} disabled={saving} style={btn('primary')}>{saving ? 'Booking...' : 'Book class'}</button>
        </div>
      </div>
    </div>
  );
}

// The class window, laid out like the appointment window (Kieran, Nov 2026):
// Details (the session's provider, setting, date, time and length, saved with
// Save; the attendees, each with their own status; the class's comments) and
// Patient Info (a tab per child). Attendee and comment changes save at once,
// like comments on an appointment.
function GroupClassView({ providers, existing, onClose, onChanged }) {
  const { user } = useAuth();
  const groupId = existing.group_class_id;
  const where = { date: existing.appointment_date, time: hm(existing.appointment_time), provider: existing.provider };
  const [item, setItem] = useState(existing);
  const [weekly, setWeekly] = useState(existing.members.some(m => m.is_virtual || m.exception_of_series_id));
  const [name, setName] = useState(existing.group_name || existing.patient_name);
  const [renaming, setRenaming] = useState(null); // the draft name
  const [tab, setTab] = useState('details');
  const [patientTab, setPatientTab] = useState(existing.members[0]?.patient_name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [openChild, setOpenChild] = useState(null); // { apt, startStatus }
  const [removing, setRemoving] = useState(null); // { member, scope }
  const [adding, setAdding] = useState(null); // { name, scope }
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The session's fields, as in the appointment window.
  const [provider, setProvider] = useState(existing.provider);
  const [date, setDate] = useState(existing.appointment_date);
  const [time, setTime] = useState(hm(existing.appointment_time));
  const [duration, setDuration] = useState(String(Number(existing.duration) || 30));
  const setting = useSetting(existing.treatment_area || '');
  const changed = provider !== existing.provider || date !== existing.appointment_date || time !== hm(existing.appointment_time)
    || Number(duration) !== (Number(existing.duration) || 30) || (setting.touched && setting.area !== (existing.treatment_area || ''));

  const reload = useCallback(async () => {
    const rows = await api.getAppointments(where.date);
    const found = collapseGroups(rows || []).find(a => a.is_group && String(a.group_class_id) === String(groupId) && hm(a.appointment_time) === where.time && a.provider === where.provider);
    setItem(found || null);
    if (found) setWeekly(found.members.some(m => m.is_virtual || m.exception_of_series_id));
  }, [groupId, where.date, where.time, where.provider]);
  useEffect(() => {
    api.getGroupClass(groupId).then(g => { if (g) { setName(g.name); setWeekly(w => w || g.weekly); } }).catch(() => {});
  }, [groupId]);

  // Runs a change, then reloads this sitting and the schedule behind it.
  const run = async (fn) => {
    setBusy(true); setError(null);
    try {
      await fn();
      await reload();
      onChanged?.();
      setBusy(false);
      return true;
    } catch (err) {
      setBusy(false);
      setError(err.message);
      return false;
    }
  };

  const setChildStatus = async (m, status) => {
    if (status === m.appointment_status) return;
    if (await opensWindowForStatus(m, status)) { setOpenChild({ apt: m, startStatus: status }); return; }
    const fields = { appointment_status: status, treatment_area: areaAfterStatus(status, m.treatment_area) };
    await run(() => (m.is_virtual
      ? api.createRecurringException(m.series_id, {
        occurrence_date: m.appointment_date, appointment_date: m.appointment_date, patient_name: m.patient_name, provider: m.provider,
        appointment_time: m.appointment_time, duration: m.duration, ...fields,
      })
      : api.updateAppointment(m.id, fields)));
  };

  const session = item || existing;
  const members = item?.members || [];
  const sittingBody = { date: where.date, from_time: where.time };
  const childWeekly = (m) => !!(m.is_virtual || m.exception_of_series_id);

  const saveRename = () => run(async () => { const g = await api.renameGroupClass(groupId, renaming.trim()); setName(g.name); setRenaming(null); });
  const saveAdd = () => run(() => api.addGroupClassChild(groupId, {
    ...sittingBody, patient_name: adding.name, scope: weekly ? adding.scope : 'one',
    provider: session.provider, appointment_time: hm(session.appointment_time), duration: session.duration, treatment_area: session.treatment_area,
  })).then(ok => ok && setAdding(null));
  const saveRemove = () => run(() => api.removeGroupClassChild(groupId, { ...sittingBody, patient_name: removing.member.patient_name, scope: removing.scope }))
    .then(ok => ok && setRemoving(null));

  // Save: like an appointment's, it closes the window. A weekly class asks
  // which weeks first.
  const save = async (scope) => {
    if (!changed) { onClose(); return; }
    if (!date || !time || !provider) { setError('Date, time and provider are required.'); return; }
    if (weekly && !scope) { setConfirmingSave(true); return; }
    const ok = await run(() => api.moveGroupClass(groupId, {
      ...sittingBody, scope: scope || 'one',
      appointment_date: date, appointment_time: time, duration: Number(duration), provider,
      ...(setting.touched ? { treatment_area: setting.area || null } : {}),
    }));
    if (ok) onClose();
    else setConfirmingSave(false);
  };
  const remove = async (scope) => {
    const ok = await run(() => api.deleteGroupClass(groupId, { ...sittingBody, scope }));
    if (ok) onClose();
    else setConfirmingDelete(false);
  };

  const tabBtn = (value, text, current, onPick) => (
    <button
      key={value}
      type="button"
      onClick={() => onPick(value)}
      style={{
        border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        background: current === value ? 'white' : 'transparent', color: current === value ? '#111827' : '#6b7280',
      }}
    >
      {text}
    </button>
  );
  const shownPatient = members.some(m => m.patient_name === patientTab) ? patientTab : members[0]?.patient_name;

  return (
    <>
      <div style={overlay} onClick={onClose}>
        <div style={box} onClick={e => e.stopPropagation()}>
          <div style={{ marginBottom: 12 }}>
            {renaming !== null ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ ...input, marginBottom: 0 }} value={renaming} maxLength={120} onChange={e => setRenaming(e.target.value)} aria-label="Class name" autoFocus />
                <button type="button" onClick={() => setRenaming(null)} style={btn()}>Cancel</button>
                <button type="button" onClick={saveRename} disabled={busy || !renaming.trim()} style={btn('primary')}>Save</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: BRAND_SERIF, fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{name}</span>
                <button type="button" onClick={() => setRenaming(name)} style={linkBtn}>Rename</button>
              </div>
            )}
            <div style={{ fontSize: 12.5, color: '#4b5563', fontWeight: 600, marginTop: 4 }}>Group class{weekly ? ' · Weekly' : ''}</div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 4 }}>
              {session.provider} &middot; {dateLabel(where.date)} &middot; {formatSlotLabel(hm(session.appointment_time))}
            </div>
          </div>

          <div style={{ display: 'inline-flex', gap: 4, background: '#F1F2F4', borderRadius: 8, padding: 3, marginBottom: 12 }}>
            {tabBtn('details', 'Details', tab, setTab)}
            {tabBtn('patient', 'Patient Info', tab, setTab)}
          </div>

          {tab === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0 12px' }}>
                <div>
                  <label htmlFor="kl-group-provider" style={label}>Provider *</label>
                  <select id="kl-group-provider" style={input} value={provider} onChange={e => setProvider(e.target.value)}>
                    {providers.map(p => <option key={p.id} value={p.Name}>{p.Name}</option>)}
                    {!providers.some(p => p.Name === provider) && <option value={provider}>{provider} (archived)</option>}
                  </select>
                </div>
                <div>
                  <span style={{ ...label }}>Setting</span>
                  {setting.buttons}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.8fr)', gap: '0 12px' }}>
                <DateField label="Date *" value={date} onChange={setDate} />
                <TimeField label="Time *" value={time} onChange={setTime} anyTime />
                <div>
                  <label htmlFor="kl-group-minutes" style={label}>Minutes</label>
                  <select id="kl-group-minutes" style={input} value={duration} onChange={e => setDuration(e.target.value)}>
                    {(CLASS_MINUTES.includes(Number(duration)) ? CLASS_MINUTES : [...CLASS_MINUTES, Number(duration)]).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              {setting.details}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={label}>Attendees</span>
                {item && <span style={{ fontSize: 12, color: BRAND.muted }}>{groupStatusText(item)}</span>}
              </div>
              {!item && <p style={{ fontSize: 13, color: BRAND.muted, marginTop: 0 }}>Nobody is in this class on this day any more.</p>}
              {members.length > 0 && (
                <div style={{ border: '1px solid #e2e4e9', borderRadius: 8, marginBottom: 8 }}>
                  {members.map((m, i) => {
                    const c = statusColor(m.appointment_status);
                    return (
                      <div key={m.id} style={{ borderTop: i ? '1px solid #f1f2f4' : 'none', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: c, flexShrink: 0 }} />
                          <span style={{ color: '#111827', fontSize: 13.5, fontWeight: 600, flex: '1 1 150px' }}>{m.patient_name}</span>
                          <select
                            value={m.appointment_status}
                            disabled={busy}
                            onChange={e => setChildStatus(m, e.target.value)}
                            aria-label={`Status for ${m.patient_name}`}
                            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', border: `1px solid color-mix(in srgb, ${c} 40%, white)`, background: `color-mix(in srgb, ${c} 12%, white)`, color: c, cursor: 'pointer' }}
                          >
                            {(childStatuses().includes(m.appointment_status) ? childStatuses() : [...childStatuses(), m.appointment_status]).map(st => <option key={st} value={st}>{st}</option>)}
                          </select>
                          <button type="button" onClick={() => setOpenChild({ apt: m })} style={btn()}>Open</button>
                          <button type="button" onClick={() => setRemoving({ member: m, scope: 'one' })} aria-label={`Remove ${m.patient_name} from the class`} style={{ ...linkBtn, color: '#6b7280', fontSize: 16, lineHeight: 1 }}>×</button>
                        </div>
                        {m.makeup && <div style={{ fontSize: 11.5, color: BRAND.muted, margin: '3px 0 0 13px' }}>Make-up scheduled</div>}
                        {removing?.member.id === m.id && (
                          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                            <p style={{ fontSize: 13, color: '#991b1b', margin: '0 0 8px', fontWeight: 500 }}>
                              Take {m.patient_name} out of the class? Their session is removed, not canceled.
                            </p>
                            {childWeekly(m) && <ScopeChoice name={`remove-${m.id}`} value={removing.scope} onChange={(sc) => setRemoving(r => ({ ...r, scope: sc }))} />}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button type="button" onClick={() => setRemoving(null)} disabled={busy} style={btn()}>Keep</button>
                              <button type="button" onClick={saveRemove} disabled={busy} style={btn('dangerSolid')}>{busy ? 'Removing...' : 'Remove'}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {item && (adding ? (
                <div style={panel}>
                  {adding.name ? (
                    <p style={{ fontSize: 13.5, margin: '0 0 10px' }}>
                      Add <strong>{adding.name}</strong>{' '}
                      <button type="button" onClick={() => setAdding(a => ({ ...a, name: '' }))} style={linkBtn}>Change</button>
                    </p>
                  ) : (
                    <ChildSearch exclude={members.map(m => m.patient_name)} disabled={members.length >= MAX_CHILDREN} onPick={(n) => setAdding(a => ({ ...a, name: n }))} />
                  )}
                  {weekly && <ScopeChoice name="add-scope" value={adding.scope} onChange={(sc) => setAdding(a => ({ ...a, scope: sc }))} />}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setAdding(null)} disabled={busy} style={btn()}>Cancel</button>
                    <button type="button" onClick={saveAdd} disabled={busy || !adding.name} style={btn('primary')}>{busy ? 'Adding...' : 'Add'}</button>
                  </div>
                </div>
              ) : members.length < MAX_CHILDREN && (
                <button type="button" onClick={() => setAdding({ name: '', scope: 'future' })} style={{ ...linkBtn, marginBottom: 14 }}>+ Add a child</button>
              ))}

              {item && (
                <CommentsThread
                  comments={item.comments || ''}
                  currentUser={user}
                  onAppend={async (text) => (await api.groupClassComment(groupId, { date: where.date, action: 'append', text })).comments}
                  onRemove={async (commentId) => (await api.groupClassComment(groupId, { date: where.date, action: 'delete', commentId })).comments}
                  onUpdated={(comments) => { setItem(it => (it ? { ...it, comments } : it)); onChanged?.(); }}
                  label={weekly ? 'Comments (this week)' : 'Comments'}
                />
              )}
            </>
          )}

          {tab === 'patient' && (
            members.length === 0 ? <p style={{ fontSize: 13, color: BRAND.muted }}>Nobody is in this class on this day any more.</p> : (
              <>
                <div role="tablist" aria-label="Children" style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid #e2e4e9', marginBottom: 12 }}>
                  {members.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      role="tab"
                      aria-selected={shownPatient === m.patient_name}
                      onClick={() => setPatientTab(m.patient_name)}
                      style={{
                        border: 'none', background: 'none', padding: '6px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
                        color: shownPatient === m.patient_name ? 'var(--brand-primary)' : '#6b7280',
                        borderBottom: `2px solid ${shownPatient === m.patient_name ? 'var(--brand-primary)' : 'transparent'}`,
                      }}
                    >
                      {m.patient_name}
                    </button>
                  ))}
                </div>
                {shownPatient && <PatientDetailsPanel key={shownPatient} patientName={shownPatient} />}
              </>
            )
          )}

          {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}

          {confirmingSave ? (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 3, background: BRAND.tint, border: `1.5px solid ${BRAND.box}` }}>
              <p style={{ fontSize: 13, color: 'var(--brand-ink)', margin: '0 0 10px 0', fontWeight: 500 }}>
                This is a weekly class. Apply this change to just this week, or to this and all future weeks? Every child in the class moves.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" onClick={() => save('one')} disabled={busy} style={btn()}>{busy ? 'Saving...' : 'Just This One'}</button>
                <button type="button" onClick={() => save('future')} disabled={busy} style={btn('primary')}>{busy ? 'Saving...' : 'This & All Future'}</button>
                <button type="button" onClick={() => setConfirmingSave(false)} disabled={busy} style={btn()}>Cancel</button>
              </div>
            </div>
          ) : confirmingDelete ? (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p style={{ fontSize: 13, color: '#991b1b', margin: '0 0 10px 0', fontWeight: 500 }}>
                {weekly
                  ? 'This is a weekly class. Delete just this week, or this and all future weeks? This removes every child\'s session from the schedule. To keep a record that the class didn\'t happen, set the children to Canceled instead.'
                  : 'Delete this class? Every child\'s session is removed. This can\'t be undone.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" onClick={() => remove('one')} disabled={busy} style={btn('dangerSolid')}>{busy ? 'Deleting...' : 'Delete This Only'}</button>
                {weekly && <button type="button" onClick={() => remove('future')} disabled={busy} style={btn('dangerSolid')}>{busy ? 'Deleting...' : 'Delete This & All Future'}</button>}
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} style={btn()}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              {item ? <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy} style={btn('danger')}>Delete</button> : <div />}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={onClose} style={btn()}>Cancel</button>
                <button type="button" onClick={() => save()} disabled={busy || !item} style={btn('primary')}>{busy ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Beside the class window, not inside it: a click in the child's
          window must not reach the class window's backdrop. */}
      {openChild && (
        <AppointmentModal
          providers={providers}
          existing={openChild.apt}
          defaultDate={new Date(`${where.date}T00:00:00`)}
          prefill={openChild.startStatus ? { startStatus: openChild.startStatus } : null}
          onClose={() => setOpenChild(null)}
          onSaved={() => { setOpenChild(null); reload().catch(() => {}); onChanged?.(); }}
          onCommentsSynced={() => { reload().catch(() => {}); onChanged?.(); }}
        />
      )}
    </>
  );
}
