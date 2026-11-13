// NYC Early Intervention Program Consent to Release/Obtain Information, NYC
// form 8/24 (Kieran, Nov 2026: "identical to NYC's page", like the session
// notes). The Power Form with these question ids is shown to the parent as
// NYC's page 1 (NycConsentForm.jsx) and printed the same way
// (nycConsentSection in eiFormsPdf.js). Its questions are fixed by the API
// (kidz-lounge-api lib/nycConsent.js); only the office's starting answers
// change in the builder.
export const NYC_CONSENT_FOOTER = 'Consent to Release/Obtain Information Form 8/24';

const KEY_IDS = ['rel_direction', 'rel_abc', 'rel_b_name'];
export const isNycConsent = (fields) => Array.isArray(fields) && KEY_IDS.every(id => fields.some(f => f && f.id === id));

// NYC's form has a box to tick for A only: B and C are chosen by filling in
// their box. The answer keeps all three as ticks (rel_abc), so B and C follow
// whether their Name / Organization is filled in.
export function abcFor(fields, values, changed = {}) {
  const opts = fields.find(f => f.id === 'rel_abc')?.options || [];
  const [a, b, c] = opts;
  const v = { ...values, ...changed };
  const now = new Set(Array.isArray(v.rel_abc) ? v.rel_abc : []);
  const filled = (id) => !!String(v[id] || '').trim();
  if (b) { if (filled('rel_b_name')) now.add(b); else now.delete(b); }
  if (c) { if (filled('rel_c_name')) now.add(c); else now.delete(c); }
  return [a, b, c].filter(o => o && now.has(o));
}
