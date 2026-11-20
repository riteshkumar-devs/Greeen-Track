import { Activity, LogIn, LogOut, X } from 'lucide-react';
import { useState } from 'react';
import { ErrorBanner } from '../components/ErrorBanner';
import { AdminPortal, type AdminTab } from '../features/admin/AdminPortal';
import { RoleLoginPanel } from '../features/auth/RoleLoginPanel';
import { CitizenPortal } from '../features/citizen/CitizenPortal';
import { CollectorPortal, type CollectorSection } from '../features/collector/CollectorPortal';
import { authService } from '../services/authService';
import type { Health } from '../types/api';
import { useAuth } from './AuthContext';

type PublicPortalView = 'citizen' | 'collector' | 'admin';

export function AppShell() {
  const { user, isLoadingAuth, logout } = useAuth();
  const [publicPortal, setPublicPortal] = useState<PublicPortalView>('citizen');
  const [collectorSection, setCollectorSection] = useState<CollectorSection>('tasks');
  const [adminTab, setAdminTab] = useState<AdminTab>('infrastructure');

  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [healthResult, setHealthResult] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<unknown>(null);

  const handleCheckHealth = async () => {
    setHealthError(null);
    setHealthResult(null);
    try {
      const res = await authService.getHealth();
      setHealthResult(res);
    } catch (err) {
      setHealthError(err);
    }
  };

  const handleLogout = () => {
    logout();
    setPublicPortal('citizen');
  };

  const activeRole = user?.role ?? null;

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="gt-dashboard-bg" aria-hidden="true">
        <div className="gt-orb gt-orb-one" />
        <div className="gt-orb gt-orb-two" />
      </div>
      {/* Strict 3-Zone Top Navigation Bar with Role-Distributed Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              if (!activeRole || activeRole === 'CITIZEN') setPublicPortal('citizen');
              else if (activeRole === 'COLLECTOR') setCollectorSection('tasks');
              else if (activeRole === 'ADMIN') setAdminTab('infrastructure');
            }}
            className="gt-interactive shrink-0 whitespace-nowrap text-3xl font-bold leading-none tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
          >
            GreenTrack
          </a>

          <nav
            aria-label={user ? `${user.role.toLowerCase()} workspace navigation` : 'Public portal navigation'}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto px-2 text-xs font-medium sm:gap-6 sm:text-sm"
          >
            {activeRole === 'COLLECTOR' ? (
              (
                [
                  { id: 'tasks', label: 'Assigned Tasks' },
                  { id: 'inspect', label: 'Inspect & Complete' },
                  { id: 'incident', label: 'Report Incident' },
                ] as { id: CollectorSection; label: string }[]
              ).map((item) => {
                const active = collectorSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCollectorSection(item.id)}
                    className={`rounded-md border-b-2 px-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-[#047857] text-slate-900'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })
            ) : activeRole === 'ADMIN' ? (
              (
                [
                  { id: 'infrastructure', label: 'Zones & Bins' },
                  { id: 'workforce', label: 'Collectors & Tasks' },
                  { id: 'analytics', label: 'Monthly Analytics' },
                  { id: 'routing', label: 'Routes & Incidents' },
                ] as { id: AdminTab; label: string }[]
              ).map((item) => {
                const active = adminTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAdminTab(item.id)}
                    className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-[#047857] text-slate-900'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })
            ) : !user ? (
              (
                [
                  { id: 'citizen', label: 'Citizen Check-In' },
                  { id: 'collector', label: 'Collector Portal' },
                  { id: 'admin', label: 'Admin Console' },
                ] as { id: PublicPortalView; label: string }[]
              ).map((item) => {
                const active = publicPortal === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPublicPortal(item.id)}
                    className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-[#047857] text-slate-900'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })
            ) : null}
          </nav>

          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="gt-interactive inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSignInOpen(true)}
                className="gt-interactive inline-flex items-center gap-1.5 rounded-md bg-[#047857] px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-[#065F46] whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Workspace Identity & API Health Bar */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-2.5 text-xs text-slate-600">
          <div>
            {isLoadingAuth ? (
              <span>Verifying session…</span>
            ) : user ? (
              <span>
                Signed in as <strong className="font-medium text-slate-900">{user.display_name}</strong> · Role:{' '}
                <span className="font-mono font-medium text-slate-900">{user.role}</span>
              </span>
            ) : (
              <span>Public citizen check-in · Collector and Admin workspaces require authentication</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleCheckHealth()}
            className="gt-interactive inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Activity className="h-3 w-3" />
            <span>Check /health</span>
          </button>
        </div>
      </div>

      <main className="gt-page-enter relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {healthResult && (
          <div className="mb-6 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-950">
            <span>
              API Health: <strong className="font-mono">{healthResult.status}</strong> · Service:{' '}
              <span className="font-mono">{healthResult.service}</span>
            </span>
            <button
              type="button"
              onClick={() => setHealthResult(null)}
              className="text-emerald-800 hover:text-emerald-950"
              aria-label="Close health status"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {healthError ? (
          <div className="mb-6">
            <ErrorBanner error={healthError} onDismiss={() => setHealthError(null)} title="Health check failed" />
          </div>
        ) : null}

        {activeRole === 'COLLECTOR' ? (
          <CollectorPortal
            activeSection={collectorSection}
            onSectionChange={setCollectorSection}
          />
        ) : activeRole === 'ADMIN' ? (
          <AdminPortal
            activeTab={adminTab}
            onTabChange={setAdminTab}
          />
        ) : publicPortal === 'collector' ? (
          <CollectorPortal
            activeSection={collectorSection}
            onSectionChange={setCollectorSection}
          />
        ) : publicPortal === 'admin' ? (
          <AdminPortal
            activeTab={adminTab}
            onTabChange={setAdminTab}
          />
        ) : (
          <CitizenPortal onOpenSignIn={() => setIsSignInOpen(true)} />
        )}
      </main>

      {/* Global Sign-In Modal */}
      {isSignInOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Account sign in"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="relative w-full max-w-md">
            <button
              type="button"
              onClick={() => setIsSignInOpen(false)}
              aria-label="Close sign in dialog"
              className="absolute top-4 right-4 z-10 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
            <RoleLoginPanel
              onAuthenticated={() => setIsSignInOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
