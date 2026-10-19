import { api } from './api';
import { canAdminister } from './roles';

// "Okay outside my hours" (Kieran, Oct 2026; API lib/hoursOk.js): a session
// outside its provider's contracted hours is a conflict until the provider,
// or an Admin / Developer, okays it. The okay counts only while the session
// still has the slot it was okayed for (provider, date or a series' weekday,
// time, length), so a moved session is flagged again. Same slot rules as the
// API; change both together.
const time5 = (t) => String(t || '').slice(0, 5);
const day = (d) => String(d || '').slice(0, 10);
const weekdayOf = (d) => new Date(`${day(d)}T00:00:00`).getDay();
const appointmentSlot = (a) => `${a.provider}|${day(a.appointment_date)}|${time5(a.appointment_time)}|${Number(a.duration) || 30}`;
const seriesSlotOf = (a) => `${a.provider}|w${weekdayOf(a.appointment_date)}|${time5(a.appointment_time)}|${Number(a.duration) || 30}`;

// { by, at, note } when this session is okayed as it stands, else null.
export function hoursOkOf(a) {
  if (!a) return null;
  if (a.hours_ok_by && a.hours_ok_slot === appointmentSlot(a)) return { by: a.hours_ok_by, at: a.hours_ok_at, note: a.hours_ok_note };
  const s = a.series_hours_ok;
  if (s && s.by && s.slot === seriesSlotOf(a)) return { by: s.by, at: s.at, note: s.note };
  return null;
}

// The session's own provider, or an Admin / Developer (not Reception).
export const canOkayHours = (user, provider) => canAdminister(user) || (!!user?.providerName && user.providerName === provider);

// Okays (ok true) or takes back the okay. A weekly series is okayed as a
// whole: a virtual occurrence goes to its series; an edited one takes its
// series along on the server.
export function setHoursOk(apt, ok, note = '') {
  return apt.is_virtual
    ? api.setSeriesHoursOk(apt.series_id, { ok, note })
    : api.setAppointmentHoursOk(apt.id, { ok, note });
}
