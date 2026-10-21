import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { TasksProvider } from './TasksContext';
import { ChatProvider } from './ChatContext';
import { RequireAuth, RequireLoggedIn, RequireAdmin, RequireManage, RedirectIfAuthed } from './ProtectedRoute';
import { PendingTimeOffProvider } from './PendingTimeOffContext';
import NavBar from './NavBar';
import TaskDrawer from './TaskDrawer';
import ChatWidget from './ChatWidget';
import LoginPage from './pages/LoginPage';
import SetPasswordPage from './pages/SetPasswordPage';
import SchedulePage from './pages/SchedulePage';
import PatientsPage from './pages/PatientsPage';
import PatientChartPage from './pages/PatientChartPage';
import WeeklySchedulePage from './pages/WeeklySchedulePage';
// Pages most people don't open first load when they're first visited
// (Oct 2026: the whole app was one 1.3 MB download before the first
// screen). The schedules, Patients, the chart and sign-in stay in the main
// bundle. Each lazy page shows "Loading..." for a moment the first time.
const TasksPage = lazy(() => import('./pages/TasksPage'));
const MyWorkPage = lazy(() => import('./pages/MyWorkPage'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'));
const MyTimePage = lazy(() => import('./pages/MyTimePage'));
const WaitlistPage = lazy(() => import('./pages/WaitlistPage'));
const ManualPage = lazy(() => import('./pages/ManualPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const StaffProfilePage = lazy(() => import('./pages/admin/StaffProfilePage'));
import SupportPage from './pages/SupportPage';
const SupportTicketsPage = lazy(() => import('./pages/SupportTicketsPage'));
import Footer from './Footer';
import SupportNotifier from './SupportNotifier';
import WhatsNewNotifier from './WhatsNewNotifier';
const BillingPage = lazy(() => import('./pages/BillingPage'));
const PowerFormPage = lazy(() => import('./pages/PowerFormPage'));
const SessionSignPage = lazy(() => import('./pages/SessionSignPage'));
const PowerFormsPage = lazy(() => import('./pages/PowerFormsPage'));
const ProviderDirectoryPage = lazy(() => import('./pages/ProviderDirectoryPage'));
const CredentialsPage = lazy(() => import('./pages/CredentialsPage'));
const CentralPage = lazy(() => import('./pages/CentralPage'));
const SessionNotesPage = lazy(() => import('./SessionNotes').then(m => ({ default: m.SessionNotesPage })));
const SessionNotePage = lazy(() => import('./SessionNotes').then(m => ({ default: m.SessionNotePage })));
const ProgressReportsPage = lazy(() => import('./ProgressReports').then(m => ({ default: m.ProgressReportsPage })));
const ProgressReportPage = lazy(() => import('./ProgressReports').then(m => ({ default: m.ProgressReportPage })));
const EvalReportsPage = lazy(() => import('./EvalReports').then(m => ({ default: m.EvalReportsPage })));
const EvalReportPage = lazy(() => import('./EvalReports').then(m => ({ default: m.EvalReportPage })));
const CompliancePage = lazy(() => import('./CompliancePage'));
import { featureOn } from './brand';

function AppShell() {
  return (
    <PendingTimeOffProvider>
      <TasksProvider>
        <ChatProvider>
          {/* Fills the window, so on a short page the footer still sits at
              the bottom of the screen (index.css .kl-shell / .kl-main). */}
          <div className="kl-shell">
          <NavBar />
          <TaskDrawer />
          <ChatWidget />
          <main className="kl-main">
          <Suspense fallback={<p style={{ padding: 28, fontSize: 13.5, color: '#71717A' }}>Loading...</p>}>
          <Routes>
            {/* PedsDesk ("ei") opens on My work; the daily schedule lives at /schedule
                (Kidz Lounge keeps it at /, and /schedule works there too). */}
            <Route path="/" element={<RequireAuth>{featureOn('ei') ? <MyWorkPage /> : <SchedulePage />}</RequireAuth>} />
            <Route path="/schedule" element={<RequireAuth><SchedulePage /></RequireAuth>} />
            <Route path="/weekly" element={<RequireAuth><WeeklySchedulePage /></RequireAuth>} />
            <Route path="/billing" element={<RequireAuth><BillingPage key="payroll" section="payroll" /></RequireAuth>} />
            {/* The "mandates" feature splits Billing into three pages (BillingPage.jsx SECTIONS). */}
            {/* EI Hub = mandates + claims (Oct 2026); its Claims tab is for the office only. */}
            {featureOn('mandates') && <Route path="/mandates" element={<Navigate to="/ei-hub?view=mandates" replace />} />}
            {featureOn('mandates') && <Route path="/ei-hub" element={<RequireAuth><BillingPage key="eihub" section="eihub" /></RequireAuth>} />}
            {featureOn('ei') && <Route path="/session-notes" element={<RequireAuth><SessionNotesPage /></RequireAuth>} />}
            {featureOn('ei') && <Route path="/session-notes/note" element={<RequireAuth><SessionNotePage /></RequireAuth>} />}
            {featureOn('ei') && <Route path="/progress-reports" element={<RequireAuth><ProgressReportsPage /></RequireAuth>} />}
            {featureOn('ei') && <Route path="/progress-reports/:id" element={<RequireAuth><ProgressReportPage /></RequireAuth>} />}
            {featureOn('ei') && <Route path="/eval-reports" element={<RequireAuth><EvalReportsPage /></RequireAuth>} />}
            {featureOn('ei') && <Route path="/eval-reports/report" element={<RequireAuth><EvalReportPage /></RequireAuth>} />}
            {featureOn('ei') && <Route path="/compliance" element={<RequireManage><CompliancePage /></RequireManage>} />}
            <Route path="/patients" element={<RequireAuth><PatientsPage /></RequireAuth>} />
            <Route path="/waitlist" element={<RequireAuth><WaitlistPage /></RequireAuth>} />
            <Route path="/patients/:name" element={<RequireAuth><PatientChartPage /></RequireAuth>} />
            {/* Pages under the username menu */}
            <Route path="/profile" element={<RequireAuth><MyProfilePage /></RequireAuth>} />
            <Route path="/time" element={<RequireAuth><MyTimePage /></RequireAuth>} />
            <Route path="/tasks" element={<RequireAuth><TasksPage /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/admin/staff/:username" element={<RequireAdmin><StaffProfilePage /></RequireAdmin>} />
            {/* Power Forms builder (footer link, Admins and Developers) */}
            <Route path="/power-forms" element={<RequireAdmin><PowerFormsPage /></RequireAdmin>} />
            {/* Provider directory (footer link, everyone signed in) */}
            <Route path="/provider-directory" element={<RequireAuth><ProviderDirectoryPage /></RequireAuth>} />
            <Route path="/credentials" element={<RequireManage><CredentialsPage /></RequireManage>} />
            <Route path="/central" element={<RequireAuth><CentralPage /></RequireAuth>} />
            {/* Help & Support: open to everyone, signed in or not */}
            <Route path="/support" element={<SupportPage />} />
            <Route path="/manual" element={<ManualPage />} />
            <Route path="/support/tickets" element={<RequireAuth><SupportTicketsPage /></RequireAuth>} />
            {/* Old address for the single "My Page" -- keeps bookmarks working */}
            <Route path="/me" element={<Navigate to="/profile" replace />} />
          </Routes>
          </Suspense>
          </main>
          <Footer />
          </div>
          <WhatsNewNotifier />
          <SupportNotifier />
        </ChatProvider>
      </TasksProvider>
    </PendingTimeOffProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<p style={{ padding: 28, fontSize: 13.5, color: '#71717A' }}>Loading...</p>}>
        <Routes>
          <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route path="/set-password" element={<RequireLoggedIn><SetPasswordPage /></RequireLoggedIn>} />
          {/* A parent's Power Form (secure link, no sign-in, no staff navigation). */}
          <Route path="/f/:token" element={<PowerFormPage />} />
          {/* A telehealth parent signs an EI session note (PedsDesk "ei"; secure link, no sign-in). */}
          {featureOn('ei') && <Route path="/s/:token" element={<SessionSignPage />} />}
          <Route path="/*" element={<AppShell />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
