import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import {
  AppointmentModal, DateField, TimeField, OffsiteSettingButtons, STATUS_OPTIONS, HOLD_STATUS, TREATMENT_AREA_OPTIONS,
  statusColor, formatSlotLabel, roomDisplayText, makeOffsiteArea, isHoldPatient, dateToInputValue, BRAND, BRAND_SERIF,
} from './pages/SchedulePage';
import { CENTER, settingOfArea, roomOfArea, offsiteLocation, areaAfterStatus } from './appointmentSetting';
import { collapseGroups, groupStatusText, MIN_CHILDREN, MAX_CHILDREN } from './groupClasses';
import { opensWindowForStatus } from './eiCancel';

// The group class window (src/groupClasses.js; Kieran, Nov 2026). With no
// `existing` it books a class: a name, the children, and the session as in
// the appointment window (provider, setting, date, time, length, repeat).
// With `existing` (a class card from collapseGroups) it shows that sitting:
// every child with their own status menu, Open (their own appointment
// window, for notes, why absent, make-ups and comments), remove, add a
// child, change the time or place, rename and delete. A weekly class asks
// "This week only" or "This & all future" for changes to the class.
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
const sectionTitle = { fontSize: 13, fontWeight: 600, color: '#111827', margin: '4px 0 8px' };
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
  const fields = (
    <>
      <span style={{ ...label }}>Setting</span>
      <div style={{ marginBottom: 12 }}><OffsiteSettingButtons value={setting} onChange={setSetting} /></div>
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
  return { area, touched, fields };
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

function GroupClassView({ providers, existing, onClose, onChanged }) {
  const navigate = useNavigate();
  const groupId = existing.group_class_id;
  // This sitting: the class, day, time and provider (they change on a move).
  const [where, setWhere] = useState({ date: existing.appointment_date, time: hm(existing.appointment_time), provider: existing.provider });
  const [item, setItem] = useState(existing);
  const [weekly, setWeekly] = useState(existing.members.some(m => m.is_virtual || m.exception_of_series_id));
  const [name, setName] = useState(existing.group_name || existing.patient_name);
  const [renaming, setRenaming] = useState(null); // the draft name
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [openChild, setOpenChild] = useState(null); // { apt, startStatus }
  const [removing, setRemoving] = useState(null); // { member, scope }
  const [adding, setAdding] = useState(null); // { name, scope }
  const [moving, setMoving] = useState(null); // { date, time, duration, provider, scope }
  const [deleting, setDeleting] = useState(null); // { scope }

  const reload = useCallback(async (at = where) => {
    const rows = await api.getAppointments(at.date);
    const found = collapseGroups(rows || []).find(a => a.is_group && String(a.group_class_id) === String(groupId) && hm(a.appointment_time) === at.time && a.provider === at.provider);
    setItem(found || null);
    if (found) setWeekly(found.members.some(m => m.is_virtual || m.exception_of_series_id));
  }, [groupId, where]);
  useEffect(() => {
    api.getGroupClass(groupId).then(g => { if (g) { setName(g.name); setWeekly(w => w || g.weekly); } }).catch(() => {});
  }, [groupId]);

  // Runs a change, then reloads this sitting and the schedule behind it.
  const run = async (fn, at) => {
    setBusy(true); setError(null);
    try {
      await fn();
      await reload(at);
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
  const saveMove = () => {
    const next = { date: moving.date, time: moving.time, provider: moving.provider };
    return run(() => api.moveGroupClass(groupId, {
      ...sittingBody, scope: weekly ? moving.scope : 'one',
      appointment_date: moving.date, appointment_time: moving.time, duration: Number(moving.duration), provider: moving.provider,
      ...(moving.areaTouched ? { treatment_area: moving.area || null } : {}),
    }), next).then(ok => { if (ok) { setWhere(next); setMoving(null); } });
  };
  const saveDelete = () => run(() => api.deleteGroupClass(groupId, { ...sittingBody, scope: weekly ? deleting.scope : 'one' }))
    .then(ok => { if (ok) onClose(); });

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
            <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 4 }}>
              Group class · {session.provider} · {dateLabel(where.date)} · {formatSlotLabel(hm(session.appointment_time))} · {Number(session.duration) || 30} min
              {session.treatment_area ? ` · ${roomDisplayText(session.treatment_area)}` : ''}{weekly ? ' · Weekly' : ''}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={sectionTitle}>Attendees</p>
            {item && <span style={{ fontSize: 12, color: BRAND.muted }}>{groupStatusText(item)}</span>}
          </div>
          {!item && <p style={{ fontSize: 13, color: BRAND.muted }}>Nobody is in this class on this day any more.</p>}
          {members.length > 0 && (
            <div style={{ border: '1px solid #e2e4e9', borderRadius: 8, marginBottom: 12 }}>
              {members.map((m, i) => {
                const c = statusColor(m.appointment_status);
                const isRemoving = removing?.member.id === m.id;
                return (
                  <div key={m.id} style={{ borderTop: i ? '1px solid #f1f2f4' : 'none', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => navigate(`/patients/${encodeURIComponent(m.patient_name)}`)}
                        style={{ ...linkBtn, color: '#111827', fontSize: 13.5, fontWeight: 600, flex: '1 1 160px', textAlign: 'left' }}>
                        {m.patient_name}
                      </button>
                      <select
                        value={m.appointment_status}
                        disabled={busy}
                        onChange={e => setChildStatus(m, e.target.value)}
                        aria-label={`Status for ${m.patient_name}`}
                        style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', border: `1px solid color-mix(in srgb, ${c} 40%, white)`, background: `color-mix(in srgb, ${c} 12%, white)`, color: c, cursor: 'pointer' }}
                      >
                        {(childStatuses().includes(m.appointment_status) ? childStatuses() : [...childStatuses(), m.appointment_status]).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button type="button" onClick={() => setOpenChild({ apt: m })} style={btn()}>Open</button>
                      <button type="button" onClick={() => setRemoving({ member: m, scope: 'one' })} aria-label={`Remove ${m.patient_name} from the class`} style={{ ...linkBtn, color: '#6b7280', fontSize: 16, lineHeight: 1 }}>×</button>
                    </div>
                    {(m.makeup || (m.comments && String(m.comments).trim())) && (
                      <div style={{ fontSize: 11.5, color: BRAND.muted, marginTop: 3 }}>
                        {m.makeup ? 'Make-up scheduled' : ''}{m.makeup && m.comments ? ' · ' : ''}{m.comments && String(m.comments).trim() ? 'Has comments' : ''}
                      </div>
                    )}
                    {isRemoving && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 6, background: '#FCEBEB', border: '1px solid #E9A5A5' }}>
                        <p style={{ fontSize: 13, color: '#791F1F', margin: '0 0 8px', fontWeight: 500 }}>
                          Take {m.patient_name} out of the class? Their session is removed, not canceled.
                        </p>
                        {childWeekly(m) && <ScopeChoice name={`remove-${m.id}`} value={removing.scope} onChange={(s) => setRemoving(r => ({ ...r, scope: s }))} />}
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
              <p style={{ ...sectionTitle, marginTop: 0 }}>Add a child</p>
              {adding.name ? (
                <p style={{ fontSize: 13.5, margin: '0 0 10px' }}>
                  <strong>{adding.name}</strong>{' '}
                  <button type="button" onClick={() => setAdding(a => ({ ...a, name: '' }))} style={linkBtn}>Change</button>
                </p>
              ) : (
                <ChildSearch exclude={members.map(m => m.patient_name)} disabled={members.length >= MAX_CHILDREN} onPick={(n) => setAdding(a => ({ ...a, name: n }))} />
              )}
              {weekly && <ScopeChoice name="add-scope" value={adding.scope} onChange={(s) => setAdding(a => ({ ...a, scope: s }))} />}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAdding(null)} disabled={busy} style={btn()}>Cancel</button>
                <button type="button" onClick={saveAdd} disabled={busy || !adding.name} style={btn('primary')}>{busy ? 'Adding...' : 'Add'}</button>
              </div>
            </div>
          ) : members.length < MAX_CHILDREN && !moving && !deleting && (
            <button type="button" onClick={() => setAdding({ name: '', scope: 'future' })} style={{ ...linkBtn, marginBottom: 14 }}>+ Add a child</button>
          ))}

          {moving && <MoveFields providers={providers} moving={moving} setMoving={setMoving} weekly={weekly} busy={busy} onCancel={() => setMoving(null)} onSave={saveMove} />}

          {deleting && (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 6, background: '#FCEBEB', border: '1px solid #E9A5A5' }}>
              <p style={{ fontSize: 13, color: '#791F1F', margin: '0 0 8px', fontWeight: 500 }}>
                Delete this class? Every child's session is removed. To mark it as not happening, set each child to Canceled instead.
              </p>
              {weekly && <ScopeChoice name="delete-scope" value={deleting.scope} onChange={(s) => setDeleting({ scope: s })} />}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setDeleting(null)} disabled={busy} style={btn()}>Keep</button>
                <button type="button" onClick={saveDelete} disabled={busy} style={btn('dangerSolid')}>{busy ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          )}

          {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <div>
              {item && !deleting && !moving && <button type="button" onClick={() => setDeleting({ scope: 'one' })} style={btn('danger')}>Delete class</button>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} style={btn()}>Close</button>
              {item && !moving && !deleting && (
                <button type="button" onClick={() => setMoving({ date: where.date, time: where.time, duration: String(Number(session.duration) || 30), provider: session.provider, area: session.treatment_area || '', areaTouched: false, scope: 'one' })} style={btn('primary')}>
                  Change time or place
                </button>
              )}
            </div>
          </div>
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

// "Change time or place": the class's day, time, length, provider and
// setting, for this week or from this week on.
function MoveFields({ providers, moving, setMoving, weekly, busy, onCancel, onSave }) {
  const setting = useSetting(moving.area);
  useEffect(() => {
    if (setting.touched && setting.area !== moving.area) setMoving(m => ({ ...m, area: setting.area, areaTouched: true }));
  }, [setting.touched, setting.area, moving.area, setMoving]);
  const set = (k) => (v) => setMoving(m => ({ ...m, [k]: v }));
  return (
    <div style={panel}>
      <p style={{ ...sectionTitle, marginTop: 0 }}>Change time or place</p>
      <label htmlFor="kl-group-move-provider" style={label}>Provider</label>
      <select id="kl-group-move-provider" style={input} value={moving.provider} onChange={e => set('provider')(e.target.value)}>
        {providers.map(p => <option key={p.id} value={p.Name}>{p.Name}</option>)}
        {!providers.some(p => p.Name === moving.provider) && <option value={moving.provider}>{moving.provider}</option>}
      </select>
      {setting.fields}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.8fr)', gap: '0 12px' }}>
        <DateField label="Date" value={moving.date} onChange={set('date')} />
        <TimeField label="Time" value={moving.time} onChange={set('time')} anyTime />
        <div>
          <label htmlFor="kl-group-move-minutes" style={label}>Minutes</label>
          <select id="kl-group-move-minutes" style={input} value={moving.duration} onChange={e => set('duration')(e.target.value)}>
            {(CLASS_MINUTES.includes(Number(moving.duration)) ? CLASS_MINUTES : [...CLASS_MINUTES, Number(moving.duration)]).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      {weekly && <ScopeChoice name="move-scope" value={moving.scope} onChange={set('scope')} />}
      <p style={{ fontSize: 12, color: BRAND.muted, margin: '0 0 10px' }}>Every child in the class moves, canceled ones included.</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btn()}>Cancel</button>
        <button type="button" onClick={onSave} disabled={busy} style={btn('primary')}>{busy ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}
