import { Activity, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FeedbackInbox } from '../citizen/BinFeedback';
import { useAuth } from '../../app/AuthContext';
import { citizenService } from '../../services/citizenService';
import type { BinCreated, DisposalEvent, Incident, Task } from '../../types/api';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { RoleLoginPanel } from '../auth/RoleLoginPanel';
import { RoutesView } from '../routes/RoutesView';
import { CollectorsAndTasksView } from './CollectorsAndTasksView';
import { ZonesAndBinsView } from './ZonesAndBinsView';

export type AdminTab = 'infrastructure' | 'workforce' | 'analytics' | 'routing';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'infrastructure', label: 'Zones & Bins' },
  { id: 'workforce', label: 'Collectors & Tasks' },
  { id: 'analytics', label: 'Monthly Analytics' },
  { id: 'routing', label: 'Routes & Incidents' },
];

interface AdminPortalProps {
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
}

export function AdminPortal({ activeTab = 'infrastructure', onTabChange }: AdminPortalProps) {
  const { user } = useAuth();
  const isAuthorized = user?.role === 'ADMIN';
  const [internalTab, setInternalTab] = useState<AdminTab>(activeTab);
  const currentTab = onTabChange ? activeTab : internalTab;
  const setTab = (tab: AdminTab) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };

  const [issuedCards, setIssuedCards] = useState<Record<string, Pick<BinCreated, 'qr_token' | 'qr_payload'>>>({});
  const [sessionTasks, setSessionTasks] = useState<Task[]>([]);
  const [sessionIncidents, setSessionIncidents] = useState<Incident[]>([]);
  const [liveEvents, setLiveEvents] = useState<DisposalEvent[]>([]);
  const [liveError, setLiveError] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;
    let active = true;
    const refresh = async () => {
      try {
        const result = await citizenService.getMyDisposalEvents();
        if (active) {
          setLiveEvents(result.items);
          setLiveError(false);
        }
      } catch {
        if (active) setLiveError(true);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="py-6">
        <RoleLoginPanel requiredRole="ADMIN" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FeedbackInbox />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Admin Operations &amp; Planning Console
          </h1>
          <p className="text-sm text-slate-600">
            Manage civic zones, bins, QR credentials, workforce tasks, monthly recommendations, and Round 3 route replanning.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                currentTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="gt-page-enter rounded-xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="gt-status-live inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Radio className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Live QR activity</h2>
              <p className="text-xs text-slate-500">Updates automatically every 2 seconds after participation is confirmed.</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${liveError ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
            <Activity className="h-3 w-3" aria-hidden="true" />
            {liveError ? 'Waiting for activity feed' : 'Live'}
          </span>
        </div>
        {liveEvents.length === 0 ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">No QR participation recorded yet.</p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {liveEvents.slice(0, 6).map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="font-mono text-xs font-semibold text-slate-900">{event.bin_code}</p>
                <p className="mt-1 text-[11px] text-slate-500">{new Date(event.accepted_at).toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-emerald-700">Participation recorded</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {currentTab === 'infrastructure' && <ZonesAndBinsView key={user.id} adminId={user.id} issuedCards={issuedCards}
        onIssue={(id, card) => setIssuedCards(previous => ({ ...previous, [id]: card }))} />}
      {currentTab === 'workforce' && (
        <CollectorsAndTasksView
          createdTasks={sessionTasks}
          onTaskCreated={(t) => setSessionTasks((prev) => [t, ...prev])}
        />
      )}
      {currentTab === 'analytics' && <AnalyticsView />}
      {currentTab === 'routing' && (
        <RoutesView
          sessionTasks={sessionTasks}
          sessionIncidents={sessionIncidents}
          onIncidentCreated={(inc) => setSessionIncidents((prev) => [inc, ...prev])}
        />
      )}
    </div>
  );
}
