import { featureOn } from './brand';

// Group classes (Kieran, Nov 2026; the `groupClasses` feature, both
// clinics): one provider with several children at the same time. Each child
// still has their own appointment (kidz-lounge-api routes/groupClasses.js),
// tied to the class by group_class_id, so billing, notes and make-ups work
// per child. The schedules show the class as ONE card: collapseGroups turns
// a class's children into a single item, and GroupClassModal opens it.
export const groupClassesOn = () => featureOn('groupClasses');

// NYC's EI group sessions are 2 to 10 children (the API checks too).
export const MIN_CHILDREN = 2;
export const MAX_CHILDREN = 10;

const MISSED = ['Canceled', 'No Show'];
const hm = (t) => String(t || '').slice(0, 5);

// One sitting of a class: same class, day, time and provider. A child moved
// on their own (from their own appointment window) shows as a separate card.
const sittingKey = (a) => `${a.group_class_id}|${a.appointment_date}|${hm(a.appointment_time)}|${a.provider}`;

// The schedule's list with each class sitting as one item:
// { ...the first child's session, is_group, id: 'group:...', patient_name:
// the class name, members: [each child's own session], appointment_status:
// the class's as a whole }. Everything else passes through unchanged.
// Conflicts are still worked out on the children's own sessions.
export function collapseGroups(appointments) {
  if (!groupClassesOn()) return appointments;
  const sittings = new Map();
  const out = [];
  for (const a of appointments) {
    if (a.group_class_id == null) { out.push(a); continue; }
    const key = sittingKey(a);
    let item = sittings.get(key);
    if (!item) {
      // comments: the class's own thread for the day (the card's red *).
      item = { ...a, id: `group:${key}`, is_group: true, patient_name: a.group_name || 'Group class', members: [], comments: a.group_comments || null, makeup: null, is_makeup: false, is_eval: false };
      sittings.set(key, item);
      out.push(item);
    }
    item.members.push(a);
  }
  for (const item of sittings.values()) {
    item.members.sort((x, y) => String(x.patient_name).localeCompare(String(y.patient_name)));
    const here = item.members.filter(m => !MISSED.includes(m.appointment_status));
    // The class's room comes from a child who's coming: canceling frees a
    // child's room (appointmentSetting.js areaAfterStatus).
    if (here.length) item.treatment_area = here[0].treatment_area;
    // Everyone out: the class shows as Canceled (the narrow strip). Otherwise
    // the status most of the children coming have, e.g. Scheduled.
    if (!here.length) item.appointment_status = 'Canceled';
    else {
      const counts = {};
      here.forEach(m => { counts[m.appointment_status] = (counts[m.appointment_status] || 0) + 1; });
      item.appointment_status = Object.entries(counts).sort((p, q) => q[1] - p[1])[0][0];
    }
    item.duration = Math.max(...item.members.map(m => Number(m.duration) || 30));
  }
  return out;
}

// "3 Confirmed · 1 Canceled" (Kieran, Nov 2026): how many children have
// each status, most first.
export function groupStatusText(item) {
  const counts = new Map();
  item.members.forEach(m => counts.set(m.appointment_status, (counts.get(m.appointment_status) || 0) + 1));
  return [...counts.entries()].sort((p, q) => q[1] - p[1]).map(([status, n]) => `${n}\u00a0${status}`).join(' · '); // a wrap never splits a count from its status
}

// The card's look (Kieran, Nov 2026): always shaded as Confirmed, with the
// left bar split into one equal stripe per child, in the attendee list's
// order, in that child's status colour.
export const GROUP_CARD_STATUS = 'Confirmed';

// Is this session (or class card) in a conflict? A class card is when any
// of its children is.
export const inConflict = (apt, ids) => (apt.is_group ? apt.members.some(m => ids.has(m.id)) : ids.has(apt.id));

// A class's children clash with someone else's session (or time off, a
// closure, contracted hours) one by one; computeConflicts (SchedulePage.jsx)
// lists that once, naming the class -- unless it's the same child
// double-booked, which names the child.
export const conflictSide = (x, types) => (x.group_class_id != null && !types.includes('patient') ? `group:${x.group_class_id}|${x.appointment_date}|${hm(x.appointment_time)}` : String(x.id));
export const conflictName = (apt, c) => (apt.group_class_id != null && !c.types.includes('patient') ? (apt.group_name || 'Group class') : apt.patient_name);
