import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useTasks } from '../TasksContext';
import { useChat } from '../ChatContext';
import { useIsMobile } from '../useIsMobile';
import { Card, PageHeader, Tag } from '../dashboardUi';
import { INK, MUTED, HAIRLINE, PAGE_BG, FONT, NUMERIC, TONES, buttonStyle } from '../uiTokens';
import { AppointmentModal, formatSlotLabel, roomDisplayText } from './SchedulePage';
import { pollWhileVisible } from '../pageVisibility';

// My work (PedsDesk's home page; Kieran, Oct 2026: "limit clicks, make
// everything simple"): everything waiting on you, each row with the button
// that deals with it. Providers see their day and their paperwork; the office
// sees what's stuck across the agency. Data: API GET /my-work (routes/myWork.js),
// which reuses Compliance's rules, so the two pages always agree. Tasks stay
// in the bell's drawer (linked here with a count).

const nice = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const severityDot = { danger: TONES.danger.fg, warning: '#F79009' };

function Section({ title, count, children, empty, action }) {
  return (
    <Card pad={0} style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '14px 18px 10px', borderBottom: `1px solid ${HAIRLINE}` }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 600, color: INK, margin: 0 }}>
          {title}{count !== undefined && count !== null && <span style={{ color: MUTED, fontWeight: 400, ...NUMERIC }}> {count}</span>}
        </h2>
        {action}
      </div>
      {children === null
        ? <p style={{ margin: 0, padding: '12px 18px', fontSize: 13, color: TONES.danger.fg }}>This couldn't be worked out. Try again later.</p>
        : empty
          ? <p style={{ margin: 0, padding: '12px 18px', fontSize: 13, color: MUTED }}>{empty}</p>
          : children}
    </Card>
  );
}

// One line: a coloured dot for late / due, what it is, and its action.
function Row({ severity, main, sub, date, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderTop: `1px solid ${HAIRLINE}`, flexWrap: 'wrap' }}>
      {severity && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: severityDot[severity] || severityDot.warning }} />}
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: INK, fontWeight: 500 }}>{main}</div>
        {sub && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1 }}>{sub}</div>}
      </div>
      {date && <span style={{ fontSize: 12.5, color: severity === 'danger' ? TONES.danger.fg : MUTED, ...NUMERIC, whiteSpace: 'nowrap' }}>{date}</span>}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

const small = { padding: '5px 12px', fontSize: 12.5 };

// The last copy, shown at once while a fresh one loads (Oct 2026: opening My
// work waited on the whole request). Kept in this tab only (sessionStorage,
// per person, like the Patients filters), and only used when it's today's.
const cacheKey = (username) => `kl.mywork.${username || ''}`;
function readCache(username) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(cacheKey(username)) || 'null');
    return saved && saved.today === new Date().toLocaleDateString('en-CA') ? saved : null;
  } catch { return null; }
}
function writeCache(username, data) {
  try { sessionStorage.setItem(cacheKey(username), JSON.stringify(data)); } catch { /* full or blocked: skip */ }
}

export default function MyWorkPage() {
  const { setDrawerOpen } = useTasks();
  const isMobile = useIsMobile(768);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(() => readCache(user?.username));
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { existing } | { prefill }
  const [providers, setProviders] = useState([]);

  const load = useCallback(() => api.getMyWork()
    .then(d => { setData(d); setError(null); writeCache(user?.username, d); })
    .catch(err => setError(err.message)), [user?.username]);
  useEffect(() => { load(); return pollWhileVisible(load, 60 * 1000); }, [load]);
  useEffect(() => { api.getProviders().then(p => setProviders((p || []).filter(x => !x.archived))).catch(() => {}); }, []);

  const p = data?.provider;
  const o = data?.office;
  // A report not started yet is started (prefilled, as on the Reports page)
  // and opened, so it's one click like a session note.
  const openReport = async (x) => {
    if (!x.start) { navigate(x.href); return; }
    try {
      const { id } = await api.startProgressReport(x.start);
      navigate(`/progress-reports/${id}`);
    } catch (err) { setError(err.message); }
  };
  // Opens a chat with the provider (their existing one, or a new one) to
  // write in; nothing is sent for you.
  const { openConversation, refreshConversations } = useChat();
  const startChat = async (username) => {
    try {
      const convo = await api.createConversation({ type: 'direct', participant_usernames: [username] });
      await refreshConversations?.();
      openConversation(convo.id);
    } catch (err) { setError(err.message); }
  };

  return (
    <div style={{ background: PAGE_BG, fontFamily: FONT, minHeight: '100%' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '18px 14px 48px' : '28px 28px 60px' }}>
        <PageHeader title="My work" isMobile={isMobile} actions={(
          <button type="button" onClick={() => setDrawerOpen(true)} style={buttonStyle('secondary')}>
            My tasks{data?.open_tasks ? ` (${data.open_tasks})` : ''}
          </button>
        )} />
        {error && <p role="alert" style={{ fontSize: 13.5, color: TONES.danger.fg }}>{error}</p>}
        {!data && !error && <p style={{ fontSize: 13.5, color: MUTED }}>Loading...</p>}

        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile || !(p && o) ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: '0 20px', alignItems: 'start' }}>
            {p && (
              <div style={{ minWidth: 0 }}>
                <Section title="Today" count={p.today?.length} empty={p.today && !p.today.length ? 'No sessions today.' : null}>
                  {p.today && p.today.map(({ appointment: a, note_key: noteKey, note_done: noteDone }) => {
                    const missed = ['Canceled', 'No Show'].includes(a.appointment_status);
                    return (
                      <Row key={a.id} main={`${formatSlotLabel(String(a.appointment_time).slice(0, 5))} · ${a.patient_name}`}
                        sub={[roomDisplayText(a.treatment_area), `${a.duration} min`].filter(Boolean).join(' · ')}>
                        <Tag tone={missed ? 'danger' : a.appointment_status === 'Confirmed' ? 'success' : 'neutral'}>{a.appointment_status}</Tag>
                        {noteKey && (noteDone
                          ? <Tag tone="success">Note done</Tag>
                          : <button type="button" onClick={() => navigate(`/session-notes/note?key=${encodeURIComponent(noteKey)}`)} style={buttonStyle('primary', small)}>Write note</button>)}
                        <button type="button" onClick={() => setModal({ existing: a })} style={buttonStyle('secondary', small)}>Open</button>
                      </Row>
                    );
                  })}
                </Section>
                <Section title="Notes to finish" count={p.notes?.length} empty={p.notes && !p.notes.length ? 'All your notes are done.' : null}>
                  {p.notes && p.notes.map(x => (
                    <Row key={x.href} severity={x.severity} main={x.patient_name} sub={x.text} date={nice(x.date)}>
                      <button type="button" onClick={() => navigate(x.href)} style={buttonStyle(x.severity === 'danger' ? 'primary' : 'secondary', small)}>Open note</button>
                    </Row>
                  ))}
                </Section>
                <Section title="Make-ups to book" count={p.makeups?.length} empty={p.makeups && !p.makeups.length ? 'None owed.' : null}>
                  {p.makeups && p.makeups.map((x, i) => (
                    <Row key={i} severity={x.severity} main={x.patient_name} sub={`Missed ${nice(x.date)}`} date={`by ${nice(x.due)}`}>
                      {x.appointment && <button type="button" onClick={() => setModal({ prefill: { patientName: x.appointment.patient_name, provider: x.appointment.provider, makeupFor: x.appointment } })} style={buttonStyle('primary', small)}>Book make-up</button>}
                    </Row>
                  ))}
                </Section>
                {(p.reports === null || p.reports?.length > 0) && (
                  <Section title="Reports to write" count={p.reports?.length}>
                    {p.reports && p.reports.map(x => (
                      <Row key={`${x.href}-${x.text}`} severity={x.severity} main={x.patient_name} sub={x.text} date={x.date ? `due ${nice(x.date)}` : null}>
                        <button type="button" onClick={() => openReport(x)} style={buttonStyle('secondary', small)}>Open</button>
                      </Row>
                    ))}
                  </Section>
                )}
                {(p.cosign === null || p.cosign?.length > 0) && (
                  <Section title="To co-sign" count={p.cosign?.length}>
                    {p.cosign && p.cosign.map(x => (
                      <Row key={`${x.href}-${x.text}`} severity={x.severity} main={`${x.patient_name} · ${x.provider}`} sub={x.text} date={nice(x.date)}>
                        <button type="button" onClick={() => navigate(x.href)} style={buttonStyle('secondary', small)}>Open</button>
                      </Row>
                    ))}
                  </Section>
                )}
              </div>
            )}

            {o && (
              <div style={{ minWidth: 0 }}>
                <Section title="Late notes by provider" count={o.late_notes?.length} empty={o.late_notes && !o.late_notes.length ? 'No notes are late.' : null}>
                  {o.late_notes && o.late_notes.map(x => (
                    <Row key={x.provider} severity="danger" main={x.provider} sub={`${x.count} note${x.count === 1 ? '' : 's'} late`} date={`oldest ${nice(x.oldest)}`}>
                      {x.username && <button type="button" onClick={() => startChat(x.username)} style={buttonStyle('secondary', small)}>Message</button>}
                      <Link to={`/session-notes?provider=${encodeURIComponent(x.provider)}`} style={{ ...buttonStyle('secondary', small), textDecoration: 'none' }}>Open list</Link>
                    </Row>
                  ))}
                </Section>
                <Section title="Reports to approve or send" count={o.to_approve?.length} empty={o.to_approve && !o.to_approve.length ? 'Nothing waiting.' : null}>
                  {o.to_approve && o.to_approve.map(x => (
                    <Row key={x.href} severity={x.severity} main={`${x.patient_name} · ${x.provider}`} sub={x.text} date={x.date ? `due ${nice(x.date)}` : null}>
                      <button type="button" onClick={() => navigate(x.href)} style={buttonStyle('primary', small)}>{x.kind === 'not_sent' ? 'Mark sent' : 'Review'}</button>
                    </Row>
                  ))}
                </Section>
                <Section title="New children in intake" count={o.intake?.length} empty={o.intake && !o.intake.length ? 'No one in intake.' : null}>
                  {o.intake && o.intake.map(x => (
                    <Row key={x.patient_name} severity={x.severity} main={x.patient_name} date={x.date ? `due ${nice(x.date)}` : null}>
                      <button type="button" onClick={() => navigate(x.href)} style={buttonStyle('secondary', small)}>Open chart</button>
                    </Row>
                  ))}
                </Section>
                <Section title="Authorizations ending" count={o.authorizations?.length} empty={o.authorizations && !o.authorizations.length ? 'None ending with sessions booked.' : null}>
                  {o.authorizations && o.authorizations.map(x => (
                    <Row key={`${x.patient_name}-${x.text}`} severity={x.severity} main={x.patient_name} sub={x.text} date={x.date ? `ends ${nice(x.date)}` : null}>
                      <button type="button" onClick={() => navigate(x.href)} style={buttonStyle('secondary', small)}>Open chart</button>
                    </Row>
                  ))}
                </Section>
                {(o.forms === null || o.forms?.length > 0) && (
                  <Section title="Power Forms to review" count={o.forms?.length}>
                    {o.forms && o.forms.map((x, i) => (
                      <Row key={i} main={x.patient_name} sub={x.text} date={nice(x.date)}>
                        <button type="button" onClick={() => navigate(x.href)} style={buttonStyle('secondary', small)}>Review</button>
                      </Row>
                    ))}
                  </Section>
                )}
                {o.approvals && (o.approvals.time_off > 0 || o.approvals.hours > 0) && (
                  <Section title="Requests to approve">
                    <Row main={[o.approvals.time_off && `${o.approvals.time_off} time off`, o.approvals.hours && `${o.approvals.hours} contracted hours`].filter(Boolean).join(' · ')}>
                      <button type="button" onClick={() => navigate('/admin?tab=time-off')} style={buttonStyle('primary', small)}>Review</button>
                    </Row>
                  </Section>
                )}
              </div>
            )}
            {!p && !o && <p style={{ fontSize: 13.5, color: MUTED }}>Nothing is set up for your account here. Your tasks are in the bell.</p>}
          </div>
        )}
      </div>

      {modal && (
        <AppointmentModal
          providers={providers}
          existing={modal.existing || null}
          prefill={modal.prefill || null}
          defaultDate={new Date()}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          onCommentsSynced={load}
        />
      )}
    </div>
  );
}
