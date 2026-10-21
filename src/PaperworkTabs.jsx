import { useNavigate, useLocation } from 'react-router-dom';
import { UnderlineTabs } from './dashboardUi';

// Paperwork (PedsDesk; Kieran, Oct 2026: one page, one menu item): session
// notes, progress reports and evaluation reports as tabs. Each is still its
// own route, so links into them keep working.
const PAPERWORK_TABS = [
  { key: '/session-notes', label: 'Session notes' },
  { key: '/progress-reports', label: 'Progress reports' },
  { key: '/eval-reports', label: 'Evaluation reports' },
];

export default function PaperworkTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = PAPERWORK_TABS.find(t => pathname === t.key)?.key || PAPERWORK_TABS[0].key;
  return <UnderlineTabs label="Paperwork" active={active} onPick={(k) => navigate(k)} tabs={PAPERWORK_TABS} style={{ marginBottom: 18 }} />;
}
