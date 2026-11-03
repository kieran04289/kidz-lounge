import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { Tag } from './dashboardUi';
import { INK, MUTED, SUBTLE, HAIRLINE, NUMERIC, TONES, buttonStyle } from './uiTokens';
import { employmentLabel } from './employment';
import { DateField, dateToInputValue } from './pages/SchedulePage';

// Admin time off > Time taken (Kieran, Nov 2026: "an easier spot to look at
// all staff PTO & UPTO" with date ranges and a total). Each person's
// approved PTO and UPTO in the chosen range (GET /time-off/taken), with the
// total underneath. A request counts its approved hours; one crossing the
// range's edge counts its share inside it -- the same figure as the
// billing sheet. Click a person for their requests. `nameQuery` is the
// board's name filter.

const fmt = (h) => `${Math.round(Number(h) * 100) / 100} h`;
const monthRange = (offset) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: dateToInputValue(first), to: dateToInputValue(last) };
};
const PRESETS = [
  { key: 'this', label: 'This month', range: () => monthRange(0) },
  { key: 'last', label: 'Last month', range: () => monthRange(-1) },
  { key: 'year', label: 'This year', range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: `${new Date().getFullYear()}-12-31` }) },
];
const day = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const time = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const when = (q) => (q.start_date === q.end_date
  ? `${day(q.start_date)}, ${time(q.start_time)} – ${time(q.end_time)}`
  : `${day(q.start_date)} – ${day(q.end_date)}`);

export default function TimeOffTakenBoard({ nameQuery = '', isMobile }) {
  const [range, setRange] = useState(() => monthRange(0));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // username

  const valid = range.from && range.to && range.to >= range.from;
  useEffect(() => {
    if (!valid) return undefined;
    let alive = true;
    api.getTimeOffTaken(range.from, range.to)
      .then(r => { if (alive) { setData(r); setError(null); } })
      .catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [range.from, range.to, valid]);

  const rows = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    return (data?.rows || []).filter(r => !q || r.display_name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q));
  }, [data, nameQuery]);
  const totals = useMemo(() => rows.reduce((t, r) => ({ PTO: t.PTO + r.PTO, UPTO: t.UPTO + r.UPTO }), { PTO: 0, UPTO: 0 }), [rows]);
  const preset = PRESETS.find(p => { const r = p.range(); return r.from === range.from && r.to === range.to; })?.key;

  const exportCsv = () => {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Employee', 'Type', 'PTO hours', 'UPTO hours', 'Total hours'].map(cell).join(',')];
    rows.forEach(r => lines.push([r.display_name, employmentLabel(r.employment_type), r.PTO, r.UPTO, Math.round((r.PTO + r.UPTO) * 100) / 100].map(cell).join(',')));
    lines.push(['Total', '', Math.round(totals.PTO * 100) / 100, Math.round(totals.UPTO * 100) / 100, Math.round((totals.PTO + totals.UPTO) * 100) / 100].map(cell).join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `time-off-${range.from}-to-${range.to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const cols = isMobile ? 'minmax(0, 1fr) 64px 64px 64px' : 'minmax(0, 1fr) 120px 100px 100px 100px';
  const head = { fontSize: 12, color: MUTED, fontWeight: 500 };
  const right = { textAlign: 'right', ...NUMERIC };
  const num = (h, strong) => <span style={{ ...right, fontSize: 13.5, color: h ? INK : SUBTLE, fontWeight: strong ? 600 : 400 }}>{fmt(h)}</span>;
  const field = { padding: '7px 10px', borderRadius: 6, border: `1px solid ${HAIRLINE}`, fontSize: isMobile ? 15 : 13, boxSizing: 'border-box', fontFamily: 'inherit', width: isMobile ? '100%' : 170 };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '12px 0 4px' }}>
        <DateField value={range.from} onChange={v => setRange(r => ({ ...r, from: v }))} max={range.to || undefined} placeholder="From" floating ariaLabel="From date" style={field} />
        <span style={{ fontSize: 13, color: MUTED }}>to</span>
        <DateField value={range.to} onChange={v => setRange(r => ({ ...r, to: v }))} min={range.from || undefined} placeholder="To" floating ariaLabel="To date" style={field} />
        {PRESETS.map(p => (
          <button key={p.key} type="button" onClick={() => setRange(p.range())} aria-pressed={preset === p.key}
            style={buttonStyle(preset === p.key ? 'primary' : 'secondary', { fontSize: 12.5, padding: '6px 10px' })}>{p.label}</button>
        ))}
        <button type="button" onClick={exportCsv} disabled={!data || !rows.length} style={buttonStyle('text', { fontSize: 13, marginLeft: isMobile ? 0 : 'auto' })}>Export CSV</button>
      </div>
      {!valid && <p style={{ fontSize: 13, color: TONES.danger.fg, margin: '8px 0 0' }}>Choose an end date on or after the start date.</p>}
      {error && <p role="alert" style={{ fontSize: 13, color: TONES.danger.fg, margin: '8px 0 0' }}>{error}</p>}

      {!data ? <p style={{ fontSize: 13, color: MUTED }}>Loading time off...</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '12px 0 7px', borderBottom: `1px solid ${HAIRLINE}` }}>
            <span style={head}>Employee</span>
            {!isMobile && <span style={head}>Type</span>}
            <span style={{ ...head, ...right }}>PTO</span>
            <span style={{ ...head, ...right }}>UPTO</span>
            <span style={{ ...head, ...right }}>Total</span>
          </div>
          {rows.length === 0 && <p style={{ fontSize: 13.5, color: MUTED, margin: '16px 0' }}>{nameQuery.trim() ? 'No employees match that name.' : 'No employees with PTO or UPTO.'}</p>}
          {rows.map(r => {
            const expanded = open === r.username;
            return (
              <div key={r.username} style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <button type="button" onClick={() => setOpen(expanded ? null : r.username)} aria-expanded={expanded} disabled={!r.requests.length}
                  style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '9px 0', width: '100%', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', cursor: r.requests.length ? 'pointer' : 'default' }}>
                  <span style={{ minWidth: 0, fontSize: 13.5, fontWeight: 500, color: INK }}>
                    {r.requests.length > 0 && <span aria-hidden="true" style={{ display: 'inline-block', width: 14, color: SUBTLE }}>{expanded ? '▾' : '▸'}</span>}
                    {r.display_name}
                    {r.archived && <span style={{ marginLeft: 6 }}><Tag>Archived</Tag></span>}
                    {isMobile && <span style={{ display: 'block', fontSize: 12, color: MUTED, fontWeight: 400 }}>{employmentLabel(r.employment_type)}</span>}
                  </span>
                  {!isMobile && <span style={{ fontSize: 13, color: MUTED }}>{employmentLabel(r.employment_type)}</span>}
                  {num(r.PTO)}
                  {num(r.UPTO)}
                  {num(r.PTO + r.UPTO, true)}
                </button>
                {expanded && (
                  <div style={{ padding: '0 0 10px 14px' }}>
                    {r.requests.map(q => (
                      <div key={q.id} style={{ display: 'flex', gap: 12, fontSize: 12.5, color: MUTED, padding: '3px 0', flexWrap: 'wrap' }}>
                        <span style={{ minWidth: 44, color: INK, fontWeight: 500 }}>{q.type}</span>
                        <span style={{ flex: '1 1 220px' }}>{when(q)}{q.partial ? ' (only the part in this range)' : ''}</span>
                        <span style={{ ...NUMERIC, color: INK }}>{fmt(q.hours)}</span>
                      </div>
                    ))}
                    <Link to={`/admin/staff/${encodeURIComponent(r.username)}?section=time-off`} style={{ fontSize: 12.5, color: 'var(--brand-primary)' }}>Open profile</Link>
                  </div>
                )}
              </div>
            );
          })}
          {rows.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${INK}` }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>Total</span>
              {!isMobile && <span />}
              {num(totals.PTO, true)}
              {num(totals.UPTO, true)}
              {num(totals.PTO + totals.UPTO, true)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
