import { CheckCircle2, ClipboardList, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountIdField, LocalAccountId, saveLocalAccountId } from '../../components/LocalAccountId';
import { ENV_CONFIG } from '../../config/env';
import { TaskPriorityText, TaskStatusText } from '../../components/StatusText';
import { adminService } from '../../services/adminService';
import type { Bin, Collector, Task, TaskPriority, Zone } from '../../types/api';

const PRIORITIES: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

interface CollectorsAndTasksViewProps {
  createdTasks: Task[];
  onTaskCreated: (task: Task) => void;
}

export function CollectorsAndTasksView({
  createdTasks,
  onTaskCreated,
}: CollectorsAndTasksViewProps) {
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // Register collector form
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState<Collector | null>(null);
  const [accountId, setAccountId] = useState('');
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [isSavingCollector, setIsSavingCollector] = useState(false);

  // Create collection task form
  const [taskBinId, setTaskBinId] = useState('');
  const [taskCollectorId, setTaskCollectorId] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('HIGH');
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskReason, setTaskReason] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cRes, zRes, bRes] = await Promise.all([
        adminService.listCollectors(),
        adminService.listZones(),
        adminService.listBins(),
      ]);
      setCollectors(cRes.items);
      setZones(zRes.items);
      setBins(bRes.items);
      if (!taskBinId && bRes.items.length > 0) {
        setTaskBinId(bRes.items[0].id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [taskBinId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleZoneCheckbox = (zoneId: string) => {
    setSelectedZones((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
    );
  };

  const handleCreateCollector = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSavingCollector(true);
    try {
      const input = {
        display_name: displayName.trim(),
        email: email.trim(),
        zone_ids: selectedZones,
      };
      const created = ENV_CONFIG.defaultUseMockApi
        ? await adminService.provisionCollector(editing ?? input, password, editing?.id)
        : await adminService.createCollector(input);
      setEditing(null);
      setPassword('');
      setDisplayName('');
      setEmail('');
      if (ENV_CONFIG.defaultUseMockApi && accountId) {
        try { saveLocalAccountId(created.id, accountId); }
        catch { setError(new Error('Collector registered. Browser storage could not save the GreenTrack ID.')); }
      }
      setAccountId('');
      setSelectedZones([]);
      await loadData();
    } catch (err) {
      setError(err);
    } finally {
      setIsSavingCollector(false);
    }
  };

  const handleToggleCollectorStatus = async (collector: Collector) => {
    setError(null);
    try {
      await adminService.updateCollector(collector.id, {
        status: collector.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      await loadData();
    } catch (err) {
      setError(err);
    }
  };

  const handleToggleCollectorZone = async (collector: Collector, zoneId: string) => {
    setError(null);
    const current = collector.zone_ids ?? [];
    const next = current.includes(zoneId)
      ? current.filter((id) => id !== zoneId)
      : [...current, zoneId];
    try {
      await adminService.updateCollector(collector.id, { zone_ids: next });
      await loadData();
    } catch (err) {
      setError(err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskBinId) return;
    setError(null);
    setIsCreatingTask(true);
    try {
      const task = await adminService.createCollectionTask({
        bin_id: taskBinId,
        assigned_collector_id: taskCollectorId || null,
        priority: taskPriority,
        due_at: taskDueAt ? new Date(taskDueAt).toISOString() : null,
        reason: taskReason.trim() || undefined,
      });
      onTaskCreated(task);
      setTaskReason('');
    } catch (err) {
      setError(err);
    } finally {
      setIsCreatingTask(false);
    }
  };

  return (
    <div className="space-y-8">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Collectors Roster */}
        <div className="space-y-4 lg:col-span-7">
          <h2 className="text-base font-semibold text-slate-900">
            Collector Roster &amp; Zone Assignments
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {isLoading ? (
              <div className="space-y-2 p-4">
                <div className="h-10 animate-pulse rounded bg-slate-100" />
                <div className="h-10 animate-pulse rounded bg-slate-100" />
              </div>
            ) : collectors.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">No collectors registered yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {collectors.map((c) => (
                  <div key={c.id} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{c.display_name}</p>
                        <p className="font-mono text-xs text-slate-500">{c.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleCollectorStatus(c)}
                        className={`rounded border px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                          c.status === 'ACTIVE'
                            ? 'border-emerald-200 bg-emerald-50 text-[#16A34A]'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {c.status}
                      </button>
                    </div>
                    {ENV_CONFIG.defaultUseMockApi && <LocalAccountId accountId={c.id} />}
                    {ENV_CONFIG.defaultUseMockApi && <button type="button" className="text-xs font-semibold text-emerald-700" onClick={() => {
                      setEditing(c); setDisplayName(c.display_name); setEmail(c.email); setAccountId(''); setPassword('');
                      document.getElementById('collector-password')?.focus();
                    }}>Set collector password</button>}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs text-slate-500">Zones:</span>
                      {zones.map((z) => {
                        const assigned = (c.zone_ids ?? []).includes(z.id);
                        return (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() => void handleToggleCollectorZone(c, z.id)}
                            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                              assigned
                                ? 'border-[#047857] bg-emerald-50 text-[#047857]'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {z.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session-created Tasks Log */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Tasks Dispatched This Session
            </h3>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {createdTasks.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">
                  No tasks created in this session yet. Use the Create Collection Task form to dispatch work.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3.5 py-2 font-medium">Bin</th>
                        <th className="px-3.5 py-2 font-medium">Priority</th>
                        <th className="px-3.5 py-2 font-medium">Status</th>
                        <th className="px-3.5 py-2 font-medium">Task ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {createdTasks.map((t) => (
                        <tr key={t.id}>
                          <td className="px-3.5 py-2 font-mono font-medium text-slate-900">
                            {t.bin_code}
                          </td>
                          <td className="px-3.5 py-2">
                            <TaskPriorityText priority={t.priority} />
                          </td>
                          <td className="px-3.5 py-2">
                            <TaskStatusText status={t.status} />
                          </td>
                          <td className="px-3.5 py-2 font-mono text-[11px] text-slate-500">
                            {t.id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Forms: Create Task + Register Collector */}
        <div className="space-y-6 lg:col-span-5">
          <form
            onSubmit={handleCreateTask}
            className="space-y-3.5 rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#047857]" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900">Create Collection Task</h3>
            </div>

            <div className="space-y-1">
              <label htmlFor="task-bin" className="block text-xs font-medium text-slate-700">
                Target Bin
              </label>
              <select
                id="task-bin"
                required
                value={taskBinId}
                onChange={(e) => setTaskBinId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
              >
                {bins.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bin_code} ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="task-col" className="block text-xs font-medium text-slate-700">
                  Assign Collector
                </label>
                <select
                  id="task-col"
                  value={taskCollectorId}
                  onChange={(e) => setTaskCollectorId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  <option value="">Unassigned (Pending)</option>
                  {collectors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="task-pri" className="block text-xs font-medium text-slate-700">
                  Priority
                </label>
                <select
                  id="task-pri"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="task-due" className="block text-xs font-medium text-slate-700">
                Due Date/Time (optional)
              </label>
              <input
                id="task-due"
                type="datetime-local"
                value={taskDueAt}
                onChange={(e) => setTaskDueAt(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="task-reason" className="block text-xs font-medium text-slate-700">
                Reason (optional)
              </label>
              <input
                id="task-reason"
                type="text"
                maxLength={500}
                value={taskReason}
                onChange={(e) => setTaskReason(e.target.value)}
                placeholder="High fill observation or scheduled sweep"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isCreatingTask || !taskBinId}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#047857] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#065F46] disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isCreatingTask ? 'Creating task…' : 'Create & assign task'}</span>
            </button>
          </form>

          <form
            onSubmit={handleCreateCollector}
            className="space-y-3.5 rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-slate-700" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900">{editing ? 'Set password for ' + editing.display_name : 'Register Collector'}</h3>
            </div>
            <div className="space-y-1">
              <label htmlFor="col-name" className="block text-xs font-medium text-slate-700">
                Display Name
              </label>
              <input
                id="col-name"
                readOnly={!!editing}
                type="text"
                required
                minLength={2}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jordan Rivera"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="col-email" className="block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                id="col-email"
                readOnly={!!editing}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@greentrack.org"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              {ENV_CONFIG.defaultUseMockApi && <label className="block text-xs font-medium">Collector password (8 or more characters)
                <input id="collector-password" className="mt-1 block w-full rounded border border-slate-300 p-2" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} />
              </label>}
              {ENV_CONFIG.defaultUseMockApi && !editing && <AccountIdField value={accountId} change={setAccountId} />}
              {!editing && <>
              <span className="block text-xs font-medium text-slate-700">Initial Zones</span>
              <div className="flex flex-wrap gap-1.5">
                {zones.map((z) => {
                  const checked = selectedZones.includes(z.id);
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => handleToggleZoneCheckbox(z.id)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                        checked
                          ? 'border-[#047857] bg-emerald-50 text-[#047857]'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {z.name}
                    </button>
                  );
                })}
              </div>
              </>}
            </div>
            <button
              type="submit"
              disabled={isSavingCollector}
              className="w-full rounded-md bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isSavingCollector ? 'Saving…' : editing ? 'Save password' : 'Register collector'}
            </button>
            {editing && <button type="button" onClick={() => { setEditing(null); setDisplayName(''); setEmail(''); setPassword(''); }}>Cancel</button>}
          </form>
        </div>
      </div>
    </div>
  );
}
