import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useStickyHeight } from './stickyLayout';
import { useIsMobile } from './useIsMobile';
import { useTasks } from './TasksContext';
import { Avatar } from './Avatar';
import { usePendingTimeOff } from './PendingTimeOffContext';
import { useSupportOpenCount, canSeeSupportTickets } from './supportCount';
import { canUseCentral } from './centralPractices';
import { canAdminister, canManage } from './roles';
import { CLINIC, featureOn } from './brand';
import NavSearch from './NavSearch';

const BRAND_COLOR = 'var(--brand-primary)';

const TABS = [
  { to: '/', label: 'Schedule', end: true },
  { to: '/weekly', label: 'Weekly View' },
  { to: '/patients', label: 'Patients' },
  { to: '/waitlist', label: 'Waitlist' },
  { to: '/billing', label: 'Billing' },
  // EI session notes (PedsDesk only, src/SessionNotes.jsx).
  ...(featureOn('ei') ? [{ to: '/session-notes', label: 'Notes' }, { to: '/progress-reports', label: 'Reports' }, { to: '/compliance', label: 'Compliance', manageOnly: true }] : []),
];

// The grouped nav (Oct 2026; PedsDesk: `nav: 'grouped'` in its brand file;
// Kieran: "it is often hard to find what I am looking for"): four menus
// instead of a row of links, with the footer's pages brought in, plus a
// search box (src/NavSearch.jsx). Kidz Lounge keeps the row of TABS.
const GROUPED = CLINIC.nav === 'grouped';
function navGroups(user) {
  const manage = canManage(user);
  return [
    { label: 'Schedule', items: [
      // PedsDesk's / is My work (Oct 2026), so the daily schedule is /schedule.
      { to: featureOn('ei') ? '/schedule' : '/', label: 'Daily schedule', end: true, keywords: 'today appointments calendar' },
      { to: '/weekly', label: 'Weekly view', keywords: 'week calendar' },
    ] },
    { label: 'Patients', items: [
      { to: '/patients', label: 'Patients', keywords: 'children charts add patient' },
      { to: '/waitlist', label: 'Waitlist', keywords: 'referrals waiting' },
    ] },
    // One Paperwork page (Kieran, Oct 2026): notes and reports as its tabs
    // (src/PaperworkTabs.jsx), so the menu needs just one link.
    ...(featureOn('ei') ? [{ label: 'Paperwork', items: [
      { to: '/session-notes', label: 'Paperwork', also: ['/progress-reports', '/eval-reports'], keywords: 'session notes sign parent co-sign service log progress reports ifsp review evals evaluations' },
    ] }] : []),
    { label: 'Office', items: [
      ...(featureOn('mandates') ? [
        { to: '/billing', label: 'Payroll', keywords: 'billing sheets overview payroll export units totals reviewed' },
        // EI Hub: mandates + claims (Kieran, Oct 2026). Claims inside are office-only.
        { to: '/ei-hub', label: 'EI Hub', keywords: 'ei-hub mandates make-ups makeups missed sessions needs attention owed claims 837 billing import children authorizations setup' },
      ] : [{ to: '/billing', label: 'Billing', keywords: 'billing sheet ei-hub claims' }]),
      // Compliance includes Credentials (Staff); without `ei` there's no
      // Compliance page, so Credentials keeps its own item.
      ...(featureOn('ei') && manage ? [{ to: '/compliance', label: 'Compliance', keywords: 'late overdue audit authorizations credentials licenses expiring staff turning 3' }] : []),
      ...(!featureOn('ei') && manage ? [{ to: '/credentials', label: 'Credentials', keywords: 'licenses expiring staff' }] : []),
      ...(canAdminister(user) ? [{ to: '/power-forms', label: 'Power Forms', keywords: 'forms templates packets parents' }] : []),
    ] },
  ];
}
const isActivePath = (pathname, item) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`))
  || (item.also || []).some(p => pathname === p || pathname.startsWith(`${p}/`))
  || (item.to === '/patients' && pathname.startsWith('/patients/'));

// One nav menu (desktop): opens on hover. The title itself goes to the
// menu's first page (Kieran, Oct 2026); the caret beside it opens the menu
// by click, for touch screens and the keyboard.
function GroupMenu({ group }) {
  if (group.items.length === 1) return <SingleLink item={group.items[0]} />;
  return <GroupDropdown group={group} />;
}
// A menu with one page is just a link to it (Paperwork).
function SingleLink({ item }) {
  const location = useLocation();
  return <NavLink to={item.to} end={item.end} style={() => tabStyle({ isActive: isActivePath(location.pathname, item) })}>{item.label}</NavLink>;
}
function GroupDropdown({ group }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);
  const location = useLocation();
  const active = group.items.some(i => isActivePath(location.pathname, i));
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}
      onMouseEnter={() => { clearTimeout(closeTimer.current); setOpen(true); }}
      onMouseLeave={() => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 150); }}>
      <div style={{ ...tabStyle({ isActive: active }), display: 'flex', alignItems: 'center', gap: 2, padding: 0 }}>
        <NavLink to={group.items[0].to} end={group.items[0].end} onClick={() => setOpen(false)}
          style={{ color: 'inherit', textDecoration: 'none', padding: '6px 2px 6px 14px' }}>
          {group.label}
        </NavLink>
        <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`${group.label} menu`} onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 6px 4px', border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }}>
          <Caret open={open} />
        </button>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 6, zIndex: 60 }}>
          <div role="menu" style={{ minWidth: 200, background: 'white', border: '1px solid var(--brand-border2)', borderRadius: 8, boxShadow: '0 10px 24px color-mix(in srgb, var(--brand-ink) 12%, transparent)', padding: '6px 0' }}>
            {group.items.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} role="menuitem" className="kl-menu-item" onClick={() => setOpen(false)}
                style={() => menuItemStyle({ isActive: isActivePath(location.pathname, item) })}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// PedsDesk's phone menu (Oct 2026): each section folds, so the list fits;
// the section holding the page you're on starts open.
function MobileGroups({ groups, pathname }) {
  const current = groups.find(g => g.items.some(i => isActivePath(pathname, i)))?.label || null;
  const [open, setOpen] = useState(() => new Set(current ? [current] : []));
  const toggle = (label) => setOpen(prev => { const next = new Set(prev); if (next.has(label)) next.delete(label); else next.add(label); return next; });
  return groups.map(g => {
    if (g.items.length === 1) {
      const item = g.items[0];
      return (
        <NavLink key={g.label} to={item.to} end={item.end}
          style={() => ({ ...mobileTabStyle({ isActive: isActivePath(pathname, item) }), fontWeight: 600, borderTop: '1px solid var(--brand-border2)' })}>{item.label}</NavLink>
      );
    }
    const isOpen = open.has(g.label);
    return (
      <div key={g.label} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--brand-border2)' }}>
        <button type="button" aria-expanded={isOpen} onClick={() => toggle(g.label)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', border: 'none', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: g.label === current ? BRAND_COLOR : '#374151', textAlign: 'left' }}>
          {g.label}
          <span style={{ color: '#9CA3AF', display: 'flex' }}><Caret open={isOpen} /></span>
        </button>
        {isOpen && g.items.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} style={(st) => ({ ...mobileTabStyle(st), paddingLeft: 32 })}>{item.label}</NavLink>
        ))}
      </div>
    );
  });
}

const barStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '8px 20px',
  background: 'white',
  borderBottom: "2px solid var(--brand-highlight)",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  // Stays at the top of every page (see src/stickyLayout.js).
  position: 'sticky',
  top: 0,
  zIndex: 1000,
};

function tabStyle({ isActive }) {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    color: isActive ? BRAND_COLOR : '#6b7280',
    background: isActive ? 'var(--brand-tint)' : 'transparent',
  };
}

function mobileTabStyle({ isActive }) {
  return {
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    color: isActive ? BRAND_COLOR : '#374151',
    background: isActive ? 'var(--brand-tint)' : 'transparent',
    borderBottom: '1px solid #f1f2f4',
  };
}

function MenuIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (
        <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>
      ) : (
        <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>
      )}
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18a3 3 0 0 0 6 0" />
      <path d="M4 17h16v-1a2 2 0 0 1-1-1.73V11a7 7 0 0 0-14 0v3.27A2 2 0 0 1 4 16v1z" />
    </svg>
  );
}

// Items in the username menu. `adminOnly` items are hidden from non-admins;
// `supportOnly` is only for Developers; `centralOnly` is Developers on the
// PedsDesk (Demo) site.
const ACCOUNT_LINKS = [
  { to: '/profile', label: 'My profile' },
  { to: '/time', label: 'My time' },
  { to: '/tasks', label: 'My tasks' },
  { to: '/support/tickets', label: 'Support tickets', supportOnly: true },
  { to: '/central', label: 'Central', centralOnly: true },
  { to: '/admin', label: 'Admin', adminOnly: true },
];
const SUPPORT_GREEN = '#16a34a';

function displayNameFor(user) {
  return user.preferredName || user.firstName
    ? `${user.preferredName || user.firstName} ${user.lastName || ''}`
    : user.username;
}

// Red: pending time-off requests (admins). Green: open support tickets (KJC135).
function CountBadge({ count, style, color = '#dc2626', label }) {
  if (!count) return null;
  return (
    <span
      aria-label={label ? label(count) : `${count} pending time-off ${count === 1 ? 'request' : 'requests'}`}
      style={{
        background: color, color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 999,
        minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1,
        ...style,
      }}
    >
      {count}
    </span>
  );
}

function SupportBadge({ count, style }) {
  return <CountBadge count={count} style={style} color={SUPPORT_GREEN} label={(n) => `${n} open support ${n === 1 ? 'ticket' : 'tickets'}`} />;
}

function Caret({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ transition: 'transform 120ms', transform: open ? 'rotate(180deg)' : 'none' }}>
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function menuItemStyle({ isActive }) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: '8px 14px', fontSize: 13, fontWeight: isActive ? 700 : 500, textDecoration: 'none',
    color: isActive ? BRAND_COLOR : '#374151',
    // background left unset when inactive so the .kl-menu-item:hover rule in index.css can apply
    ...(isActive ? { background: 'var(--brand-tint)' } : {}),
  };
}

// Desktop username menu: opens on hover (with a short grace period so the
// pointer can travel from the name down into the list) and also on click,
// which is what makes it work with touch screens and the keyboard.
function UserMenu({ user, links, pendingCount, supportCount, onSignOut }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);
  const location = useLocation();

  const hovering = useRef(false);

  const openNow = () => { hovering.current = true; clearTimeout(closeTimer.current); setOpen(true); };
  const closeSoon = () => { hovering.current = false; clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 150); };
  // With a mouse, hovering has already opened the menu, so a click must keep
  // it open (a plain toggle would snap it shut). Keyboard users (Enter/Space)
  // aren't hovering, so for them the click toggles open/closed.
  const handleClick = () => { if (hovering.current) setOpen(true); else setOpen(o => !o); };

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Close on Escape or a click anywhere outside the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        onClick={handleClick}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
          background: open ? 'var(--brand-tint)' : 'transparent', color: BRAND_COLOR, fontFamily: 'inherit',
        }}
      >
        <Avatar name={displayNameFor(user)} size={26} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{user.username}</span>
        <SupportBadge count={supportCount} />
        <CountBadge count={pendingCount} />
        <Caret open={open} />
      </button>

      {open && (
        // paddingTop bridges the gap under the button so hover isn't lost on the way down
        <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 6, zIndex: 60 }}>
          <div
            role="menu"
            style={{
              minWidth: 190, background: 'white', border: '1px solid var(--brand-border2)', borderRadius: 8,
              boxShadow: '0 10px 24px color-mix(in srgb, var(--brand-ink) 12%, transparent)', padding: '6px 0', overflow: 'hidden',
            }}
          >
            {links.map(link => (
              <NavLink key={link.to} to={link.to} role="menuitem" className="kl-menu-item" style={menuItemStyle}>
                {link.label}
                {link.adminOnly && <CountBadge count={pendingCount} />}
                {link.supportOnly && <SupportBadge count={supportCount} />}
              </NavLink>
            ))}
            <div style={{ height: 1, background: 'var(--brand-tint5)', margin: '6px 0' }} />
            <button
              type="button"
              role="menuitem"
              className="kl-menu-item"
              onClick={onSignOut}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', color: '#6b7280', fontFamily: 'inherit' }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const { user, logout } = useAuth();
  const visibleTabs = TABS.filter(t => !t.manageOnly || canManage(user));
  const { openCount, drawerOpen, setDrawerOpen } = useTasks();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pendingCount } = usePendingTimeOff();
  const supportCount = useSupportOpenCount(user);

  // Close the mobile menu automatically whenever the route changes, so it
  // never stays open after tapping a link or navigating via back/forward.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  // PedsDesk's phone menu: your account links fold up under your name.
  const [accountOpen, setAccountOpen] = useState(false);
  // ...and the floating chat button (src/ChatWidget.jsx) would sit on top of
  // its last items, so it steps aside while the menu is open.
  useEffect(() => {
    if (!GROUPED || !menuOpen) return undefined;
    document.body.classList.add('kl-menu-open');
    return () => document.body.classList.remove('kl-menu-open');
  }, [menuOpen]);
  const navRef = useRef(null);
  useStickyHeight(navRef, '--kl-nav-h');

  // No nav chrome on the login / set-password screens.
  if (!user) return null;

  const isAdmin = canAdminister(user); // the Admin area: not reception
  const accountLinks = ACCOUNT_LINKS.filter(l => (!l.adminOnly || isAdmin) && (!l.supportOnly || canSeeSupportTickets(user)) && (!l.centralOnly || canUseCentral(user)));
  const badgeCount = isAdmin ? pendingCount : 0;
  const groups = GROUPED ? navGroups(user) : null;
  // Everything the search box can open by name.
  const searchPages = GROUPED ? [
    ...groups.flatMap(g => g.items.map(i => ({ ...i, group: g.label }))),
    ...accountLinks.map(l => ({ to: l.to, label: l.label, group: 'Account' })),
    ...(featureOn('ei') ? [{ to: '/', label: 'My work', group: 'Home', keywords: 'home today to do todo tasks waiting late' }] : []),
    { to: '/manual', label: 'User manual', group: 'Help', keywords: 'how to guide' },
    // Out of the Patients menu (Oct 2026), still in the footer and here.
    { to: '/provider-directory', label: 'Provider directory', group: 'Help', keywords: 'therapists phone npi license' },
    { to: '/support', label: 'Help & Support', group: 'Help', keywords: 'ticket problem' },
  ] : [];

  if (!isMobile) {
    return (
      <nav ref={navRef} style={barStyle}>
        <img src={CLINIC.logo} alt={CLINIC.name} style={{ height: 34, width: 'auto', marginRight: 16 }} />
        {/* PedsDesk's home, My work (Oct 2026), comes first. */}
        {GROUPED && featureOn('ei') && <NavLink to="/" end style={tabStyle}>My work</NavLink>}
        {GROUPED ? groups.map(g => <GroupMenu key={g.label} group={g} />) : visibleTabs.map(tab => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} style={tabStyle}>
            {tab.label}
          </NavLink>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {GROUPED && <NavSearch pages={searchPages} />}
          <button
            onClick={() => setDrawerOpen(o => !o)}
            aria-label="Toggle task drawer"
            style={{
              position: 'relative', border: 'none', background: 'none', color: drawerOpen ? BRAND_COLOR : '#6b7280',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
            }}
          >
            <BellIcon />
            {openCount > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -3, background: '#dc2626', color: 'white', fontSize: 9.5, fontWeight: 700,
                borderRadius: 999, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>
                {openCount}
              </span>
            )}
          </button>
          <UserMenu user={user} links={accountLinks} pendingCount={badgeCount} supportCount={supportCount} onSignOut={logout} />
        </div>
      </nav>
    );
  }

  return (
    <nav ref={navRef} style={barStyle}>
      <img src={CLINIC.logo} alt={CLINIC.name} style={{ height: 30, width: 'auto' }} />
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Toggle task drawer"
          style={{ position: 'relative', border: 'none', background: 'none', color: drawerOpen ? BRAND_COLOR : '#6b7280', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }}
        >
          <BellIcon />
          {openCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2, background: '#dc2626', color: 'white', fontSize: 9.5, fontWeight: 700,
              borderRadius: 999, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            }}>
              {openCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          style={{
            position: 'relative', border: 'none', background: 'none', color: BRAND_COLOR,
            cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center',
          }}
        >
          <MenuIcon open={menuOpen} />
          {!menuOpen && (
            <span style={{ position: 'absolute', top: 1, right: 0, display: 'flex', gap: 2 }}>
              <SupportBadge count={supportCount} />
              <CountBadge count={badgeCount} />
            </span>
          )}
        </button>
      </div>

      {menuOpen && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
            borderBottom: "2px solid var(--brand-highlight)", boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
            zIndex: 50, display: 'flex', flexDirection: 'column',
            // PedsDesk's menu is longer than a phone screen (Oct 2026): it
            // scrolls on its own, without scrolling the page behind it.
            ...(GROUPED ? { maxHeight: 'calc(100dvh - var(--kl-nav-h, 56px))', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } : {}),
          }}
        >
          {GROUPED ? (
            <>
              <div style={{ padding: '12px 20px 4px' }}><NavSearch pages={searchPages} compact /></div>
              {featureOn('ei') && <NavLink to="/" end style={(st) => ({ ...mobileTabStyle(st), fontWeight: 600, borderTop: '1px solid var(--brand-border2)' })}>My work</NavLink>}
              <MobileGroups groups={groups} pathname={location.pathname} />
            </>
          ) : visibleTabs.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} style={mobileTabStyle}>
              {tab.label}
            </NavLink>
          ))}
          {GROUPED ? (
            <button type="button" aria-expanded={accountOpen} onClick={() => setAccountOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px 10px', border: 'none', borderTop: '1px solid var(--brand-border2)', marginTop: 6, background: 'white', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left' }}>
              <Avatar name={displayNameFor(user)} size={30} />
              <span style={{ fontSize: 13, color: BRAND_COLOR, fontWeight: 600 }}>{user.username}</span>
              <SupportBadge count={supportCount} />
              <CountBadge count={badgeCount} />
              <span style={{ marginLeft: 'auto', color: '#9CA3AF', display: 'flex' }}><Caret open={accountOpen} /></span>
            </button>
          ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px 6px', borderTop: `1px solid var(--brand-border2)`, marginTop: 6 }}>
            <Avatar name={displayNameFor(user)} size={30} />
            <span style={{ fontSize: 13, color: BRAND_COLOR, fontWeight: 600 }}>{user.username}</span>
            <SupportBadge count={supportCount} />
            <CountBadge count={badgeCount} />
          </div>
          )}
          {(!GROUPED || accountOpen) && accountLinks.map(link => (
            <NavLink key={link.to} to={link.to} style={mobileTabStyle}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {link.label}
                {link.adminOnly && <CountBadge count={badgeCount} />}
                {link.supportOnly && <SupportBadge count={supportCount} />}
              </span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={logout}
            style={{ textAlign: 'left', padding: '14px 20px', fontSize: 15, fontWeight: 600, border: 'none', borderTop: '1px solid var(--brand-border2)', background: 'white', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
