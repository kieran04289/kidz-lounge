// How sessions that overlap in one column (a provider or room on a day)
// share it, so every card stays readable instead of hiding behind another.
//   - A Canceled, No Show or HOLD session that something active is booked
//     over (the slot was re-filled) is a narrow strip in the right quarter,
//     labelled with its status (Kieran, Nov 2026: No Show and HOLD too; it
//     was Canceled only).
//   - Active sessions that overlap each other (a real double booking, still
//     a conflict with its red ring) split the width evenly, side by side:
//     halves for two, thirds for three (Kieran, Nov 2026; they used to stack
//     with a small offset, the one behind mostly hidden). Overlaps are
//     followed through a chain (A-B, B-C), and each card takes the first
//     free column, as calendars lay out meetings. When any of them also has
//     a strip beside it, they share the left three quarters.
// Returns { side: 'right' } for a strip, { side: 'left', index, count,
// narrow } for a shared card, or null for the full width.
// `columnAppointments`: every appointment in the same column, all rows.
const mins = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + (m || 0); };
const span = (a) => { const s = mins(a.appointment_time); return [s, s + (Number(a.duration) || 30)]; };
const overlaps = (a, b) => { const [s1, e1] = span(a); const [s2, e2] = span(b); return s1 < e2 && s2 < e1; };
const same = (a, b) => a === b || (a.id !== undefined && a.id !== null && String(a.id) === String(b.id));

// The strip's label for each status that becomes one.
export const STRIP_LABELS = { Canceled: 'Canceled', 'No Show': 'No Show', '*HOLD*': 'Hold' };
export const isStripStatus = (a) => Object.prototype.hasOwnProperty.call(STRIP_LABELS, a.appointment_status);

export function appointmentLane(apt, columnAppointments) {
  const others = columnAppointments.filter(o => !same(o, apt));
  if (isStripStatus(apt)) return others.some(o => !isStripStatus(o) && overlaps(apt, o)) ? { side: 'right' } : null;
  const active = [apt, ...others.filter(o => !isStripStatus(o))];
  // Everything this card overlaps, directly or through a chain.
  const cluster = [apt];
  for (let i = 0; i < cluster.length; i++) {
    active.forEach(o => { if (!cluster.some(c => same(c, o)) && overlaps(cluster[i], o)) cluster.push(o); });
  }
  const narrow = cluster.some(c => others.some(o => isStripStatus(o) && overlaps(c, o)));
  if (cluster.length === 1 && !narrow) return null;
  // First free column, earliest first (ties: longer, then id), so every
  // card in the cluster works out the same layout.
  const order = [...cluster].sort((a, b) => span(a)[0] - span(b)[0] || span(b)[1] - span(a)[1] || String(a.id).localeCompare(String(b.id)));
  const columnEnds = [];
  let index = 0;
  for (const c of order) {
    const [s, e] = span(c);
    let col = columnEnds.findIndex(end => end <= s);
    if (col === -1) { col = columnEnds.length; columnEnds.push(e); } else columnEnds[col] = e;
    if (same(c, apt)) index = col;
  }
  return { side: 'left', index, count: columnEnds.length, narrow };
}

// Statuses that don't need a room: no "Set room" pill on the card, and not
// on the daily Unassigned list (Canceled, No Show, and *HOLD* -- a held slot).
export const NO_ROOM_NEEDED = ['Canceled', 'No Show', '*HOLD*'];
