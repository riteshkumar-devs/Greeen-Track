import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../app/AuthContext';
import { ErrorBanner } from '../../components/ErrorBanner';
import { NextPickup } from './NextPickup';
import { QrScannerPanel } from '../../components/QrScannerPanel';
import { TaskPriorityText, TaskStatusText } from '../../components/StatusText';
import { CATEGORY_CODES, CATEGORY_LABELS } from '../../constants/waste';
import { citizenService } from '../../services/citizenService';
import { collectorService } from '../../services/collectorService';
import type {
  CategoryCode,
  Contamination,
  Incident,
  IncidentSeverity,
  IncidentType,
  Inspection,
  InspectionSource,
  PublicBin,
  Task,
  TaskOutcome,
  TaskStatus,
} from '../../types/api';
import { RoleLoginPanel } from '../auth/RoleLoginPanel';

export type CollectorSection = 'tasks' | 'inspect' | 'incident';

const TASK_FILTERS: { label: string; value: TaskStatus | 'ALL' }[] = [
  { label: 'All tasks', value: 'ALL' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Failed', value: 'FAILED' },
];

const CONTAMINATION_LEVELS: Contamination[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];
const INCIDENT_TYPES: IncidentType[] = ['OVERFLOW', 'BLOCKED_ROAD', 'BLOCKED_ACCESS', 'OTHER'];
const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface CollectorPortalProps {
  activeSection?: CollectorSection;
  onSectionChange?: (section: CollectorSection) => void;
}

export function CollectorPortal({
  activeSection = 'tasks',
  onSectionChange,
}: CollectorPortalProps) {
  const { user } = useAuth();
  const isAuthorized = user?.role === 'COLLECTOR';

  const [internalSection, setInternalSection] = useState<CollectorSection>(activeSection);
  const currentSection = onSectionChange ? activeSection : internalSection;
  const setSection = (sec: CollectorSection) => {
    if (onSectionChange) onSectionChange(sec);
    else setInternalSection(sec);
  };

  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<unknown>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [verifiedQrBin, setVerifiedQrBin] = useState<PublicBin | null>(null);
  const [qrError, setQrError] = useState<unknown>(null);
  const [isResolvingQr, setIsResolvingQr] = useState(false);

  // Inspection form state
  const [inspectBinId, setInspectBinId] = useState<string>('');
  const [inspectBinCode, setInspectBinCode] = useState<string>('');
  const [fillPercent, setFillPercent] = useState<number>(65);
  const [overflow, setOverflow] = useState<boolean>(false);
  const [observedCategory, setObservedCategory] = useState<CategoryCode>('WET');
  const [contamination, setContamination] = useState<Contamination>('NONE');
  const [estimatedMixed, setEstimatedMixed] = useState<string>('');
  const [source, setSource] = useState<InspectionSource>('REAL');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [inspectNotes, setInspectNotes] = useState<string>('');
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);
  const [inspectionError, setInspectionError] = useState<unknown>(null);
  const [savedInspection, setSavedInspection] = useState<Inspection | null>(null);

  // Task completion form state
  const [outcome, setOutcome] = useState<TaskOutcome>('COMPLETED');
  const [postFill, setPostFill] = useState<string>('0');
  const [exceptionReason, setExceptionReason] = useState<string>('');
  const [completeNotes, setCompleteNotes] = useState<string>('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<unknown>(null);
  const [completedTask, setCompletedTask] = useState<Task | null>(null);

  // Incident form state
  const [incidentType, setIncidentType] = useState<IncidentType>('OVERFLOW');
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentSeverity>('HIGH');
  const [incidentBinId, setIncidentBinId] = useState<string>('');
  const [roadEdgeId, setRoadEdgeId] = useState<string>('');
  const [incidentDesc, setIncidentDesc] = useState<string>('');
  const [isReportingIncident, setIsReportingIncident] = useState(false);
  const [incidentError, setIncidentError] = useState<unknown>(null);
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null);

  const loadTasks = useCallback(async () => {
    if (!isAuthorized) return;
    setIsLoadingTasks(true);
    setTasksError(null);
    try {
      const res = await collectorService.listTasks(
        statusFilter === 'ALL' ? undefined : statusFilter,
      );
      setTasks(res.items);
      if (!inspectBinId && res.items.length > 0) {
        setSelectedTask(res.items[0]);
        setInspectBinId(res.items[0].bin_id);
        setInspectBinCode(res.items[0].bin_code);
        setIncidentBinId(res.items[0].bin_id);
      }
    } catch (err) {
      setTasksError(err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [isAuthorized, statusFilter, inspectBinId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleSelectTaskForWork = (task: Task) => {
    setSelectedTask(task);
    setInspectBinId(task.bin_id);
    setInspectBinCode(task.bin_code);
    setIncidentBinId(task.bin_id);
    setSavedInspection(null);
    setCompletedTask(null);
    setSection('inspect');
  };

  const handleResolveQr = async (qrToken: string) => {
    setQrError(null);
    setIsResolvingQr(true);
    try {
      const bin = await citizenService.resolveBinQr({ qr_token: qrToken });
      setVerifiedQrBin(bin);
      setInspectBinId(bin.bin_id);
      setInspectBinCode(bin.bin_code);
      setObservedCategory(bin.category_code);
      setIncidentBinId(bin.bin_id);
      const matchingTask = tasks.find((t) => t.bin_id === bin.bin_id);
      if (matchingTask) setSelectedTask(matchingTask);
    } catch (err) {
      setQrError(err);
    } finally {
      setIsResolvingQr(false);
    }
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectBinId) return;
    setInspectionError(null);
    setSavedInspection(null);
    setIsSubmittingInspection(true);
    try {
      const parsedMixed =
        estimatedMixed.trim() !== '' ? Number(estimatedMixed.trim()) : null;
      const res = await collectorService.submitInspection(inspectBinId, {
        fill_percent: fillPercent,
        overflow,
        observed_category_code: observedCategory,
        contamination_level: contamination,
        estimated_mixed_percent: parsedMixed,
        notes: inspectNotes.trim() || undefined,
        photo_url: photoUrl.trim() || null,
        source,
      });
      setSavedInspection(res);
      void loadTasks();
    } catch (err) {
      setInspectionError(err);
    } finally {
      setIsSubmittingInspection(false);
    }
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setCompleteError(null);
    setCompletedTask(null);
    setIsCompleting(true);
    try {
      const res = await collectorService.completeTask(selectedTask.id, {
        outcome,
        post_collection_fill_percent:
          postFill.trim() !== '' ? Number(postFill.trim()) : null,
        exception_reason: exceptionReason.trim() || null,
        notes: completeNotes.trim() || undefined,
      });
      setCompletedTask(res);
      setSelectedTask(res);
      void loadTasks();
    } catch (err) {
      setCompleteError(err);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIncidentError(null);
    setCreatedIncident(null);
    setIsReportingIncident(true);
    try {
      const res = await collectorService.reportIncident({
        type: incidentType,
        severity: incidentSeverity,
        bin_id: incidentBinId || null,
        road_edge_id: roadEdgeId.trim() || null,
        description: incidentDesc.trim(),
      });
      setCreatedIncident(res);
      setIncidentDesc('');
    } catch (err) {
      setIncidentError(err);
    } finally {
      setIsReportingIncident(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="py-6">
        <RoleLoginPanel requiredRole="COLLECTOR" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Collector Field Workbench
          </h1>
          <p className="text-sm text-slate-600">
            Manage your assigned collection queue, record physical bin inspections, and report field incidents.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'tasks', label: 'Assigned Tasks' },
                { id: 'inspect', label: 'Inspect & Complete' },
                { id: 'incident', label: 'Report Incident' },
              ] as { id: CollectorSection; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  currentSection === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadTasks()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Section 1: Assigned Tasks */}
      {activeSection === 'tasks' && <NextPickup />}
      {currentSection === 'tasks' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              Assigned Collection Queue{' '}
              <span className="font-mono text-xs text-slate-500 tabular-nums">({tasks.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {TASK_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === f.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <ErrorBanner error={tasksError} onDismiss={() => setTasksError(null)} />

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {isLoadingTasks ? (
              <div className="space-y-2 p-4">
                <div className="h-10 animate-pulse rounded bg-slate-100" />
                <div className="h-10 animate-pulse rounded bg-slate-100" />
                <div className="h-10 animate-pulse rounded bg-slate-100" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                No tasks match the selected status filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Bin Code</th>
                      <th className="px-4 py-2.5 font-medium">Priority</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Due</th>
                      <th className="px-4 py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tasks.map((task) => {
                      const isSelected = selectedTask?.id === task.id;
                      return (
                        <tr
                          key={task.id}
                          className={isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}
                        >
                          <td className="px-4 py-3 font-mono font-medium text-slate-900">
                            {task.bin_code}
                          </td>
                          <td className="px-4 py-3">
                            <TaskPriorityText priority={task.priority} />
                          </td>
                          <td className="px-4 py-3">
                            <TaskStatusText status={task.status} />
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500 tabular-nums">
                            {task.due_at ? new Date(task.due_at).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleSelectTaskForWork(task)}
                              className="rounded-md bg-[#047857] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#065F46] whitespace-nowrap shrink-0"
                            >
                              Inspect &amp; complete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 2: Physical Inspection & Task Completion */}
      {currentSection === 'inspect' && (
        <div className="space-y-6">
          {/* Active Bin / Task Context Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-5 py-3.5 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-500">Active bin:</span>
              <span className="font-mono text-sm font-semibold text-slate-900">
                {inspectBinCode || 'None selected'}
              </span>
              {selectedTask && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <TaskPriorityText priority={selectedTask.priority} />
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <TaskStatusText status={selectedTask.status} />
                </>
              )}
            </div>
            {tasks.length > 0 && (
              <select
                aria-label="Switch active task"
                value={selectedTask?.id ?? ''}
                onChange={(e) => {
                  const found = tasks.find((t) => t.id === e.target.value);
                  if (found) handleSelectTaskForWork(found);
                }}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800"
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.bin_code} ({t.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <QrScannerPanel
                onResolve={handleResolveQr}
                isResolving={isResolvingQr}
                title="Verify Bin via QR Sticker"
                description="Scan the physical bin QR to confirm bin identity before logging an inspection."
              />
              <ErrorBanner error={qrError} onDismiss={() => setQrError(null)} />

              {verifiedQrBin && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-950">
                  Verified QR for <span className="font-mono font-semibold">{verifiedQrBin.bin_code}</span> ·{' '}
                  {verifiedQrBin.zone_name} · Intended stream: {CATEGORY_LABELS[verifiedQrBin.category_code]}
                </div>
              )}

              <form
                onSubmit={handleSubmitInspection}
                className="space-y-5 rounded-lg border border-slate-200 bg-white p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Submit Physical Bin Inspection
                    </h2>
                    <p className="text-xs text-slate-500">
                      Records an immutable observation with server timestamp.
                    </p>
                  </div>
                  {inspectBinCode && (
                    <span className="font-mono text-sm font-semibold text-[#047857]">
                      {inspectBinCode}
                    </span>
                  )}
                </div>

                {!inspectBinId ? (
                  <p className="text-sm text-slate-500">
                    Select a task from your queue or scan a bin QR code to begin an inspection.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label htmlFor="fill-percent" className="font-medium text-slate-700">
                            Observed Fill Percentage
                          </label>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums">
                            {fillPercent}%
                          </span>
                        </div>
                        <input
                          id="fill-percent"
                          type="range"
                          min={0}
                          max={100}
                          value={fillPercent}
                          onChange={(e) => setFillPercent(Number(e.target.value))}
                          className="w-full accent-[#047857]"
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                        <label htmlFor="overflow-check" className="text-xs font-medium text-slate-800">
                          Overflowing outside bin
                        </label>
                        <input
                          id="overflow-check"
                          type="checkbox"
                          checked={overflow}
                          onChange={(e) => setOverflow(e.target.checked)}
                          className="h-4 w-4 accent-[#DC2626]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label htmlFor="obs-cat" className="block text-xs font-medium text-slate-700">
                          Observed Dominant Waste Category
                        </label>
                        <select
                          id="obs-cat"
                          value={observedCategory}
                          onChange={(e) => setObservedCategory(e.target.value as CategoryCode)}
                          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                        >
                          {CATEGORY_CODES.map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="mixed-pct" className="block text-xs font-medium text-slate-700">
                          Estimated Mixed-Waste % (optional)
                        </label>
                        <input
                          id="mixed-pct"
                          type="number"
                          min={0}
                          max={100}
                          value={estimatedMixed}
                          onChange={(e) => setEstimatedMixed(e.target.value)}
                          placeholder="Leave blank if unassessable"
                          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-[#047857] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium text-slate-700">
                        Contamination Level
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {CONTAMINATION_LEVELS.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setContamination(lvl)}
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                              contamination === lvl
                                ? lvl === 'HIGH'
                                  ? 'border-red-600 bg-red-50 text-red-800'
                                  : lvl === 'MEDIUM'
                                    ? 'border-amber-600 bg-amber-50 text-amber-800'
                                    : 'border-[#047857] bg-emerald-50 text-[#047857]'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <span className="block text-xs font-medium text-slate-700">
                          Observation Source
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {(['REAL', 'SIMULATED'] as InspectionSource[]).map((src) => (
                            <button
                              key={src}
                              type="button"
                              onClick={() => setSource(src)}
                              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                                source === src
                                  ? src === 'SIMULATED'
                                    ? 'border-amber-600 bg-amber-50 text-amber-900'
                                    : 'border-[#047857] bg-emerald-50 text-[#047857]'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {src === 'REAL' ? 'Real Field' : 'Simulated'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="photo-url" className="block text-xs font-medium text-slate-700">
                          Photo URI (optional)
                        </label>
                        <input
                          id="photo-url"
                          type="url"
                          value={photoUrl}
                          onChange={(e) => setPhotoUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="inspect-notes" className="block text-xs font-medium text-slate-700">
                        Field Notes (optional)
                      </label>
                      <textarea
                        id="inspect-notes"
                        rows={2}
                        maxLength={1000}
                        value={inspectNotes}
                        onChange={(e) => setInspectNotes(e.target.value)}
                        placeholder="Access condition, bin damage, or contamination details..."
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                      />
                    </div>

                    <ErrorBanner error={inspectionError} onDismiss={() => setInspectionError(null)} />

                    {savedInspection && (
                      <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-950">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                        <div>
                          <p className="font-medium">
                            Inspection saved ({savedInspection.source}) · Fill {savedInspection.fill_percent}% · Contamination {savedInspection.contamination_level}
                          </p>
                          <p className="font-mono text-emerald-900 tabular-nums">
                            {new Date(savedInspection.inspected_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingInspection}
                        className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-4 py-2 text-xs font-medium text-white hover:bg-[#065F46] disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        <span>{isSubmittingInspection ? 'Saving inspection…' : 'Submit inspection'}</span>
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>

            <div className="lg:col-span-5">
              <form
                onSubmit={handleCompleteTask}
                className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
              >
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-base font-semibold text-slate-900">Record Collection Outcome</h2>
                  <p className="text-xs text-slate-500">
                    {selectedTask
                      ? `Task for bin ${selectedTask.bin_code}`
                      : 'Select an assigned task to save its collection outcome'}
                  </p>
                </div>

                {selectedTask ? (
                  <>
                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium text-slate-700">Outcome</span>
                      <div className="grid grid-cols-3 gap-2">
                        {(['COMPLETED', 'PARTIAL', 'FAILED'] as TaskOutcome[]).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setOutcome(opt)}
                            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                              outcome === opt
                                ? opt === 'FAILED'
                                  ? 'border-red-600 bg-red-50 text-red-800'
                                  : opt === 'PARTIAL'
                                    ? 'border-amber-600 bg-amber-50 text-amber-800'
                                    : 'border-[#047857] bg-emerald-50 text-[#047857]'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="post-fill" className="block text-xs font-medium text-slate-700">
                        Post-Collection Fill % (optional)
                      </label>
                      <input
                        id="post-fill"
                        type="number"
                        min={0}
                        max={100}
                        value={postFill}
                        onChange={(e) => setPostFill(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-[#047857] focus:outline-none"
                      />
                    </div>

                    {outcome !== 'COMPLETED' && (
                      <div className="space-y-1.5">
                        <label htmlFor="exc-reason" className="block text-xs font-medium text-slate-700">
                          Exception Reason
                        </label>
                        <input
                          id="exc-reason"
                          type="text"
                          maxLength={500}
                          value={exceptionReason}
                          onChange={(e) => setExceptionReason(e.target.value)}
                          placeholder="Locked gate, vehicle obstruction, etc."
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="comp-notes" className="block text-xs font-medium text-slate-700">
                        Notes (optional)
                      </label>
                      <textarea
                        id="comp-notes"
                        rows={3}
                        maxLength={1000}
                        value={completeNotes}
                        onChange={(e) => setCompleteNotes(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                      />
                    </div>

                    <ErrorBanner error={completeError} onDismiss={() => setCompleteError(null)} />

                    {completedTask && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-950">
                        Task for <span className="font-mono font-semibold">{completedTask.bin_code}</span>{' '}
                        updated to <strong>{completedTask.status}</strong>.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isCompleting}
                      className="w-full rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isCompleting ? 'Saving outcome…' : 'Save collection outcome'}
                    </button>
                  </>
                ) : (
                  <p className="py-2 text-xs text-slate-500">
                    Choose a task from your assigned queue to record completion or exception status.
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Report Operational Incident */}
      {currentSection === 'incident' && (
        <div className="mx-auto max-w-2xl">
          <form
            onSubmit={handleReportIncident}
            className="space-y-5 rounded-lg border border-slate-200 bg-white p-6"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <ShieldAlert className="h-5 w-5 text-[#D97706]" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Report Field Incident</h2>
                <p className="text-xs text-slate-500">
                  Report bin overflows, blocked access, or road obstructions from the field.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="inc-type" className="block text-xs font-medium text-slate-700">
                  Incident Type
                </label>
                <select
                  id="inc-type"
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                >
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="inc-sev" className="block text-xs font-medium text-slate-700">
                  Severity
                </label>
                <select
                  id="inc-sev"
                  value={incidentSeverity}
                  onChange={(e) => setIncidentSeverity(e.target.value as IncidentSeverity)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="inc-bin" className="block text-xs font-medium text-slate-700">
                  Related Bin (optional)
                </label>
                <select
                  id="inc-bin"
                  value={incidentBinId}
                  onChange={(e) => setIncidentBinId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                >
                  <option value="">None / Road segment</option>
                  {tasks.map((t) => (
                    <option key={t.bin_id} value={t.bin_id}>
                      {t.bin_code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="road-edge" className="block text-xs font-medium text-slate-700">
                  Road Edge ID (optional)
                </label>
                <input
                  id="road-edge"
                  type="text"
                  value={roadEdgeId}
                  onChange={(e) => setRoadEdgeId(e.target.value)}
                  placeholder="edge-north-alley"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inc-desc" className="block text-xs font-medium text-slate-700">
                Description
              </label>
              <textarea
                id="inc-desc"
                required
                rows={3}
                maxLength={1000}
                value={incidentDesc}
                onChange={(e) => setIncidentDesc(e.target.value)}
                placeholder="Describe overflow condition or access blockage..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#047857] focus:outline-none"
              />
            </div>

            <ErrorBanner error={incidentError} onDismiss={() => setIncidentError(null)} />

            {createdIncident && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
                <div>
                  <p className="font-medium">
                    Incident reported ({createdIncident.type} · {createdIncident.status})
                  </p>
                  <p className="font-mono text-[11px] text-amber-900">ID: {createdIncident.id}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isReportingIncident || !incidentDesc.trim()}
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isReportingIncident ? 'Reporting incident…' : 'Submit field incident'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
