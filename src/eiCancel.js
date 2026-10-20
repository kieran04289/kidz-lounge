import { api } from './api';
import { featureOn } from './brand';

// Cancelling an EI session from a card's status menu opens the appointment
// window with Canceled picked, so "Who cancelled?" (family / provider;
// kidz-lounge-api lib/missedBy.js) is asked rather than skipped (PedsDesk,
// "mandates" feature; Kieran, Oct 2026). Everything else saves straight away.
// The HOLD placeholder isn't a child (SchedulePage.jsx HOLD_PATIENT_NAME).
const HOLD_NAME = 'hold - see comments';
export async function opensWindowForStatus(apt, newStatus) {
  if (!featureOn('mandates') || newStatus !== 'Canceled') return false;
  if (String(apt.patient_name || '').trim().toLowerCase() === HOLD_NAME) return false;
  const r = await api.getBillingProgramOn(apt.patient_name, apt.provider, String(apt.appointment_date).slice(0, 10)).catch(() => null);
  return r?.group === 'EI';
}
