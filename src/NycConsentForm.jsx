import { DateField } from './pages/SchedulePage';
import { SignaturePad } from './PowerFormFields';
import { formatPhone } from './phone';
import { NYC_HEALTH_LOGO } from './nycHealthLogo';
import { NYC_CONSENT_FOOTER, abcFor } from './nycConsent';
import { INK, MUTED, TONES } from './uiTokens';

// NYC's Consent to Release/Obtain Information (form 8/24), page 1, to fill in
// on screen (src/nycConsent.js; Kieran, Nov 2026). Same wording, order, boxes
// and lines as the paper. On a narrow screen the side-by-side lines stack
// (Kieran: "Same page, lines stack"), so every line is big enough to type in.
// The PDF copy is eiFormsPdf.js nycConsentSection.
//
// fields: the form's questions (their options are the answers' wording).
// values / onChange(id, value) / errors: as PowerFormInputs.
// office: the builder's starting answers -- lines filled in from the chart
// show what fills them in (prefillLabels: the API's PREFILL names), and the
// parent's signature and dates are left for the parent.

const PAPER = { fontFamily: '"Times New Roman", Times, serif', color: INK, fontSize: 15.5, lineHeight: 1.45 };
const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 16px', marginBottom: 6 };
const boxStyle = { border: `1.5px solid ${INK}`, padding: '8px 10px 6px', margin: '4px 0 8px' };
const caption = { fontSize: 12.5, color: INK, display: 'block', marginTop: 1 };
const check = { width: 17, height: 17, margin: '3px 6px 0 0', flexShrink: 0, accentColor: INK, cursor: 'pointer' };

export default function NycConsentForm({ fields, values, onChange, errors = {}, disabled, office, prefillLabels = {} }) {
  const byId = Object.fromEntries((fields || []).map(f => [f.id, f]));
  const opts = (id) => byId[id]?.options || [];
  const err = (id) => !!errors[id];
  // Lines the chart fills in, shown as such in the builder.
  const fromChart = (id) => office && byId[id]?.prefill;
  const parentOnly = (id) => office && ['date', 'signature'].includes(byId[id]?.type);

  const set = (id, v) => {
    onChange(id, v);
    // The signature carries the parent's typed name (the API needs one); on
    // NYC's form that's the "I, (Parent/Guardian's Full Name)" line.
    if (id === 'rel_parent' && values.rel_signature) onChange('rel_signature', { ...values.rel_signature, name: v });
    if (id === 'rel_b_name' || id === 'rel_c_name') onChange('rel_abc', abcFor(fields, values, { [id]: v }));
  };

  // A line to write on: underlined, growing to fill its share of the row.
  const blank = (id, { grow = 1, min = 160, label, type } = {}) => {
    const kind = type || byId[id]?.type;
    const dis = disabled || fromChart(id) || parentOnly(id);
    const shown = fromChart(id) ? `[${prefillLabels[byId[id].prefill]?.label || byId[id].prefill.replace(/_/g, ' ')}]` : (values[id] || '');
    const line = {
      border: 'none', borderBottom: `1px solid ${err(id) ? TONES.danger.fg : INK}`, borderRadius: 0, background: 'transparent',
      font: 'inherit', fontSize: 15.5, color: INK, padding: '0 3px', minWidth: 0, width: '100%', boxSizing: 'border-box', outline: 'none',
    };
    let input;
    if (kind === 'date') {
      input = <DateField id={`pf-${id}`} ariaLabel={label || byId[id]?.label} yearNav clearable disabled={dis} value={fromChart(id) ? '' : (values[id] || '')} onChange={v => set(id, v || '')}
        style={{ ...line, padding: '0 3px', height: 26, display: 'flex', alignItems: 'center' }} />;
    } else {
      input = (
        <input id={`pf-${id}`} aria-label={label || byId[id]?.label} type={kind === 'phone' ? 'tel' : 'text'} inputMode={kind === 'phone' ? 'tel' : undefined}
          value={shown} disabled={dis} placeholder={kind === 'phone' ? '(___) ___-____' : undefined}
          onChange={e => set(id, kind === 'phone' ? formatPhone(e.target.value) : e.target.value)} style={line} />
      );
    }
    return (
      <span id={`pf-${id}-l`} style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: `${grow} 1 ${min}px`, minWidth: 0 }}>
        {label && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>{input}</span>
      </span>
    );
  };

  // A box to tick. `one`: ticking it picks this one answer of a choice.
  const tick = (id, option, text, { italic, one, after } = {}) => {
    const v = values[id];
    const on = one ? v === option : Array.isArray(v) && v.includes(option);
    const toggle = (checked) => {
      if (one) set(id, checked ? option : '');
      else {
        const list = Array.isArray(v) ? v : [];
        set(id, opts(id).filter(o => (o === option ? checked : list.includes(o))));
      }
    };
    return (
      <label style={{ display: 'inline-flex', alignItems: 'flex-start', cursor: disabled ? 'default' : 'pointer', fontStyle: italic ? 'italic' : 'normal', marginRight: 12 }}>
        <input type="checkbox" checked={on} disabled={disabled} onChange={e => toggle(e.target.checked)} style={{ ...check, ...(one ? { width: 21, height: 21 } : {}) }} />
        <span>{text}</span>{after}
      </label>
    );
  };

  // B, C and "sent to": a box with name / address, telephone / fax.
  const party = (prefix, title) => (
    <div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={boxStyle}>
        <div style={row}>
          <span style={{ flex: '1 1 220px', minWidth: 0 }}>{blank(`${prefix}_name`, { label: null })}<span style={caption}>(Name/ Organization)</span></span>
          <span style={{ flex: '1 1 220px', minWidth: 0 }}>{blank(`${prefix}_address`)}<span style={caption}>(Street Address, Borough/City, Zip Code)</span></span>
        </div>
        <div style={row}>
          <span style={{ flex: '0 1 200px', minWidth: 150 }}>{blank(`${prefix}_phone`, { min: 150 })}<span style={caption}>(Telephone Number)</span></span>
          <span style={{ flex: '0 1 200px', minWidth: 150 }}>{blank(`${prefix}_fax`, { min: 150 })}<span style={caption}>(Fax Number)</span></span>
        </div>
      </div>
    </div>
  );

  const [released, obtained] = opts('rel_direction');
  const info = opts('rel_info');
  const abc = opts('rel_abc');
  const purpose = opts('rel_purpose');
  const sig = values.rel_signature || {};

  return (
    <div style={PAPER}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <img src={NYC_HEALTH_LOGO} alt="NYC Health" style={{ width: 'clamp(56px, 18vw, 96px)', height: 'auto', flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16.5, lineHeight: 1.3, paddingRight: 'clamp(0px, 8vw, 96px)' }}>
          NYC EARLY INTERVENTION PROGRAM<br />CONSENT TO RELEASE/OBTAIN INFORMATION
        </div>
      </div>

      <div style={row}>{blank('rel_child', { label: 'Child’s Name:', grow: 3, min: 260 })}{blank('rel_ei', { label: 'EI #:', min: 150 })}{blank('rel_dob', { label: 'DOB:', min: 170 })}</div>
      <div style={row}>{blank('rel_address', { label: 'Address:', grow: 3, min: 260 })}{blank('rel_apt', { label: 'Apt #:', min: 150 })}</div>
      <div style={row}>{blank('rel_city', { label: 'City/Borough:', grow: 2, min: 220 })}{blank('rel_state', { label: 'State:', min: 150 })}{blank('rel_zip', { label: 'Zip Code:', min: 150 })}</div>

      {/* The name is written into the sentence, as on the paper. */}
      <div id="pf-rel_parent-l" style={{ margin: '12px 0 4px' }}>
        I, (Parent/Guardian’s Full Name){' '}
        <span style={{ display: 'inline-block', width: 'min(300px, 100%)', verticalAlign: 'baseline' }}>{blank('rel_parent')}</span>
        , seek services for my child from the NYC Early Intervention Program. I understand that the providers (including evaluators, service providers and service coordinators) offering Early Intervention (EI) services to my child and family may need to exchange information to develop and carry out the Individualized Family Service Plan (IFSP).
      </div>

      <div id="pf-rel_direction-l" style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic' }}>(Check ONLY one)</div>
        <div style={{ ...row, gap: '6px 24px', marginTop: 4, color: err('rel_direction') ? TONES.danger.fg : INK }}>
          {released && tick('rel_direction', released, released, { one: true })}
          {obtained && tick('rel_direction', obtained, obtained, { one: true })}
        </div>
      </div>
      <div style={{ borderTop: `2px solid ${INK}`, margin: '4px 0 6px' }} />

      <div id="pf-rel_info-l">
        <div style={{ fontWeight: 700, color: err('rel_info') ? TONES.danger.fg : INK }}>Specific information to be released/obtained:</div>
        <div style={{ ...row, gap: '4px 0' }}>
          {info[0] && tick('rel_info', info[0], info[0], { italic: true })}
          {info[1] && tick('rel_info', info[1], info[1], { italic: true })}
          {info[2] && tick('rel_info', info[2], 'Supplemental Evaluation(s) Specify:', { italic: true })}
          <span style={{ flex: '1 1 200px', minWidth: 0 }}>{blank('rel_supplemental')}</span>
        </div>
        <div style={{ ...row, gap: '4px 0' }}>
          {info[3] && tick('rel_info', info[3], info[3], { italic: true })}
          {info[4] && tick('rel_info', info[4], info[4], { italic: true })}
        </div>
        <div style={{ ...row, gap: '4px 0' }}>
          {info[5] && tick('rel_info', info[5], info[5], { italic: true })}
          {info[6] && tick('rel_info', info[6], 'Other:', { italic: true })}
          <span style={{ flex: '1 1 240px', minWidth: 0 }}>{blank('rel_info_other')}</span>
        </div>
      </div>

      <div id="pf-rel_abc-l" style={{ marginTop: 6, color: err('rel_abc') ? TONES.danger.fg : INK }}>
        I authorize for the information to be (<b>check/complete either A , B, or C):</b>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '4px 0 6px' }}>
          <b style={{ paddingTop: 1 }}>A.</b>
          {abc[0] && tick('rel_abc', abc[0], 'Released to all EI providers providing evaluation, service coordination, or services to my child and family')}
        </div>
      </div>
      {party('rel_b', 'B. Released to the Individual/Agency below:')}
      {party('rel_c', 'C. Obtained from the Individual/Agency below:')}
      {party('rel_to', 'The information will be sent to:')}

      <div id="pf-rel_purpose-l" style={{ marginTop: 6 }}>
        <div style={{ fontWeight: 700 }}>D. The purpose of the requested information is to: (check all that apply)</div>
        <div style={{ display: 'grid', gap: 2, marginTop: 2 }}>
          {purpose.slice(0, 4).map(o => <div key={o}>{tick('rel_purpose', o, o)}</div>)}
          {purpose[4] && (
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
              {tick('rel_purpose', purpose[4], 'Other:')}
              <span style={{ flex: '1 1 240px', minWidth: 0 }}>{blank('rel_purpose_other')}</span>
            </div>
          )}
        </div>
      </div>

      <p style={{ margin: '12px 0 4px' }}>I understand that this release can be withdrawn at any time upon written notice to my Service Coordinator.</p>
      <div style={{ ...row, marginBottom: 12 }}>
        <span>This release ends on the date of my next scheduled IFSP (or, if sooner, specify date</span>
        <span style={{ flex: '0 1 190px', minWidth: 170 }}>{blank('rel_ends', { min: 170 })}</span>
        <span>).</span>
      </div>

      <div style={{ ...row, alignItems: 'flex-start' }}>
        <div id="pf-rel_signature-l" style={{ flex: '2 1 280px', minWidth: 0 }}>
          <div style={{ color: err('rel_signature') ? TONES.danger.fg : INK }}>Signed:</div>
          {office ? (
            <div style={{ borderBottom: `1px solid ${INK}`, height: 44, color: MUTED, fontSize: 13, display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>The parent signs here</div>
          ) : (
            <SignaturePad value={sig.image || null} disabled={disabled} onChange={image => set('rel_signature', { ...sig, name: values.rel_parent || sig.name || '', image })} />
          )}
        </div>
        <div style={{ flex: '1 1 180px', minWidth: 0, paddingTop: 22 }}>{blank('rel_date', { label: 'Date:', min: 170 })}</div>
      </div>
      <div style={row}>{blank('rel_relationship', { label: 'Relationship to Child:', min: 260, grow: 0 })}</div>

      <p style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.35, margin: '14px 0 4px' }}>
        NOTE: A reproduced copy of this signed form is deemed to have the same force and effect as the original. A new Consent to Release Information form must be signed at the initial IFSP meeting and at each IFSP review and annual meeting.{' '}
        <span style={{ textDecoration: 'underline' }}>Blank consent forms should never be signed by the parent.</span>
      </p>
      <div style={{ fontSize: 13 }}>{NYC_CONSENT_FOOTER}</div>
    </div>
  );
}
