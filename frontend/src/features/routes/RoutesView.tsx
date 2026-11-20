import { AlertTriangle, GitBranch, Navigation, Search, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { GeoMap } from '../../components/GeoMap';
import {
  EstimatesSourceText,
  RouteStatusText,
  RouteStopStatusText,
} from '../../components/StatusText';
import { adminService } from '../../services/adminService';
import { routingService } from '../../services/routingService';
import type {
  Bin,
  Coordinate,
  Incident,
  IncidentSeverity,
  IncidentType,
  Route,
  Task,
  Zone,
} from '../../types/api';

const INCIDENT_TYPES: IncidentType[] = ['OVERFLOW', 'BLOCKED_ROAD', 'BLOCKED_ACCESS', 'OTHER'];
const SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface RoutesViewProps {
  sessionTasks: Task[];
  sessionIncidents: Incident[];
  onIncidentCreated: (incident: Incident) => void;
}

export function RoutesView({
  sessionTasks,
  sessionIncidents,
  onIncidentCreated,
}: RoutesViewProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [depot, setDepot] = useState<Coordinate | null>(null);
  const [pickDepotFromMap, setPickDepotFromMap] = useState(false);

  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [previousRoute, setPreviousRoute] = useState<Route | null>(null);
  const [routeHistory, setRouteHistory] = useState<Route[]>([]);
  const [lookupRouteId, setLookupRouteId] = useState<string>('');

  // Task selection for optimize
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(() =>
    sessionTasks.filter((t) => t.status !== 'COMPLETED').map((t) => t.id),
  );
  const [manualTaskIdsInput, setManualTaskIdsInput] = useState('');

  // Incident selection & creation for Round 3 replanning
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    sessionIncidents[0]?.id ?? '',
  );
  const [manualIncidentId, setManualIncidentId] = useState('');

  // Create Admin Incident form
  const [incType, setIncType] = useState<IncidentType>('BLOCKED_ROAD');
  const [incSeverity, setIncSeverity] = useState<IncidentSeverity>('HIGH');
  const [incBinId, setIncBinId] = useState<string>('');
  const [incRoadEdge, setIncRoadEdge] = useState<string>('');
  const [incDesc, setIncDesc] = useState<string>('');

  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const loadInfrastructure = useCallback(async () => {
    try {
      const [zRes, bRes] = await Promise.all([adminService.listZones(), adminService.listBins()]);
      setZones(zRes.items);
      setBins(bRes.items);
      if (!incBinId && bRes.items.length > 0) {
        setIncBinId(bRes.items[0].id);
      }
      if (zRes.items[0]?.center) {
        setDepot(zRes.items[0].center);
      }
    } catch (err) {
      setError(err);
    }
  }, [incBinId]);

  useEffect(() => {
    void loadInfrastructure();
  }, [loadInfrastructure]);

  const handleLoadRouteById = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupRouteId.trim()) return;
    setError(null);
    setIsWorking(true);
    try {
      const loaded = await routingService.getRoute(lookupRouteId.trim());
      setPreviousRoute(activeRoute);
      setActiveRoute(loaded);
      setRouteHistory((prev) =>
        prev.some((r) => r.id === loaded.id) ? prev : [loaded, ...prev],
      );
    } catch (err) {
      setError(err);
    } finally {
      setIsWorking(false);
    }
  };

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  };

  const handleOptimize = async () => {
    setError(null);
    if (!depot) {
      setError(new Error('Set the dispatch depot on the map first.'));
      return;
    }
    const parsedManual = manualTaskIdsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const task_ids = Array.from(new Set([...selectedTaskIds, ...parsedManual]));
    if (task_ids.length === 0) {
      setError(new Error('Select session tasks or enter at least one Task UUID to optimize a route.'));
      return;
    }
    setIsWorking(true);
    try {
      const created = await routingService.optimizeRoute({
        task_ids,
        depot,
      });
      setPreviousRoute(activeRoute);
      setActiveRoute(created);
      setLookupRouteId(created.id);
      setRouteHistory((prev) => [created, ...prev]);
    } catch (err) {
      setError(err);
    } finally {
      setIsWorking(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsWorking(true);
    try {
      const created = await adminService.createIncident({
        type: incType,
        severity: incSeverity,
        bin_id: incBinId || null,
        road_edge_id: incRoadEdge.trim() || null,
        description: incDesc.trim(),
      });
      onIncidentCreated(created);
      setSelectedIncidentId(created.id);
      setIncDesc('');
    } catch (err) {
      setError(err);
    } finally {
      setIsWorking(false);
    }
  };

  const handleReplan = async () => {
    if (!activeRoute) return;
    const incId = manualIncidentId.trim() || selectedIncidentId;
    if (!incId) {
      setError(new Error('Select or enter an Incident UUID before triggering Round 3 replanning.'));
      return;
    }
    setError(null);
    setIsWorking(true);
    try {
      const replanned = await routingService.replanRoute(activeRoute.id, {
        incident_id: incId,
      });
      setPreviousRoute(activeRoute);
      setActiveRoute(replanned);
      setLookupRouteId(replanned.id);
      setRouteHistory((prev) => [replanned, ...prev]);
    } catch (err) {
      setError(err);
    } finally {
      setIsWorking(false);
    }
  };

  const binCodeById = new Map(bins.map((b) => [b.id, b.bin_code]));
  const affectedSet = new Set(activeRoute?.affected_bin_ids ?? []);
  const isManualFallback =
    activeRoute?.status === 'FAILED' || activeRoute?.estimates_source === 'UNAVAILABLE';

  return (
    <div className="space-y-8">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {/* Top Route Lookup & Version Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <form onSubmit={handleLoadRouteById} className="flex flex-1 flex-wrap items-center gap-2">
          <label htmlFor="route-id-lookup" className="text-xs font-medium text-slate-700">
            Route UUID
          </label>
          <input
            id="route-id-lookup"
            type="text"
            value={lookupRouteId}
            onChange={(e) => setLookupRouteId(e.target.value)}
            placeholder="Paste route UUID for GET /admin/routes/{route_id}"
            className="min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900"
          />
          <button
            type="submit"
            disabled={isWorking || !lookupRouteId.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Load route</span>
          </button>
        </form>

        {routeHistory.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500">Versions:</span>
            {routeHistory.slice(0, 4).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setPreviousRoute(activeRoute?.id !== r.id ? activeRoute : previousRoute);
                  setActiveRoute(r);
                  setLookupRouteId(r.id);
                }}
                className={`rounded border px-2 py-1 font-mono text-xs whitespace-nowrap shrink-0 ${
                  activeRoute?.id === r.id
                    ? 'border-[#047857] bg-emerald-50 font-semibold text-[#047857]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                v{r.version} ({r.status})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Split: Map + Stop Sequence vs Optimization & Round 3 Replanning */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Depot:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">
                  {depot ? `${depot.latitude}, ${depot.longitude}` : 'Select a location'}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setPickDepotFromMap((v) => !v)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  pickDepotFromMap
                    ? 'border-[#047857] bg-emerald-50 text-[#047857]'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pickDepotFromMap ? 'Click map to place depot…' : 'Set depot on map'}
              </button>
            </div>
            <GeoMap
              zones={zones}
              bins={bins}
              route={activeRoute}
              depot={depot}
              onMapClick={
                pickDepotFromMap
                  ? (coord) => {
                      setDepot(coord);
                      setPickDepotFromMap(false);
                    }
                  : undefined
              }
              heightClass="h-96"
            />
          </div>

          {activeRoute ? (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-900">
                      Route v{activeRoute.version}
                    </span>
                    <span aria-hidden="true">·</span>
                    <RouteStatusText status={activeRoute.status} />
                    {activeRoute.estimates_source && (
                      <>
                        <span aria-hidden="true">·</span>
                        <EstimatesSourceText source={activeRoute.estimates_source} />
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 tabular-nums">
                    <span>
                      Distance:{' '}
                      <strong className="font-mono text-slate-900">
                        {activeRoute.distance_estimate_km !== null &&
                        activeRoute.distance_estimate_km !== undefined
                          ? `${activeRoute.distance_estimate_km} km`
                          : 'Unavailable'}
                      </strong>
                    </span>
                    <span>
                      Duration:{' '}
                      <strong className="font-mono text-slate-900">
                        {activeRoute.duration_estimate_minutes !== null &&
                        activeRoute.duration_estimate_minutes !== undefined
                          ? `${activeRoute.duration_estimate_minutes} min`
                          : 'Unavailable'}
                      </strong>
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-slate-400">{activeRoute.id}</span>
              </div>

              {isManualFallback && (
                <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
                  <div>
                    <p className="font-semibold">Manual Dispatch Fallback Required</p>
                    <p className="mt-0.5">
                      Automated routing failed or road-network estimates are unavailable. Use the stop sequence below for manual collector dispatch — distance and travel time estimates are intentionally withheld.
                    </p>
                  </div>
                </div>
              )}

              {activeRoute.affected_bin_ids && activeRoute.affected_bin_ids.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950">
                  <strong>Affected bins in replan v{activeRoute.version}:</strong>{' '}
                  <span className="font-mono">
                    {activeRoute.affected_bin_ids
                      .map((id) => binCodeById.get(id) ?? id)
                      .join(', ')}
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Stop #</th>
                      <th className="px-3 py-2 font-medium">Bin Code</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Replan Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeRoute.stops.map((stop) => {
                      const prevStop = previousRoute?.stops.find((p) => p.bin_id === stop.bin_id);
                      const seqChanged = prevStop && prevStop.sequence !== stop.sequence;
                      const isAffected = affectedSet.has(stop.bin_id);
                      return (
                        <tr
                          key={`${stop.bin_id}-${stop.sequence}`}
                          className={isAffected ? 'bg-amber-50/40' : undefined}
                        >
                          <td className="px-3 py-2.5 font-mono font-semibold text-slate-900 tabular-nums">
                            {stop.sequence}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-medium text-slate-900">
                            {stop.bin_code}
                          </td>
                          <td className="px-3 py-2.5">
                            <RouteStopStatusText status={stop.status} />
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 tabular-nums">
                            {stop.status === 'UNREACHABLE'
                              ? 'Marked unreachable due to incident'
                              : seqChanged
                                ? `Moved from #${prevStop.sequence} → #${stop.sequence}`
                                : isAffected
                                  ? 'Updated in replan'
                                  : stop.status === 'COMPLETED'
                                    ? 'Preserved completed stop'
                                    : 'Unchanged'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
              Create tasks in Collectors &amp; Tasks (or enter Task UUIDs) to optimize a route, or load an existing Route UUID above.
            </div>
          )}
        </div>

        {/* Right Controls: Optimize Route + Incident + Round 3 Replan */}
        <div className="space-y-6 lg:col-span-5">
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Navigation className="h-4 w-4 text-[#047857]" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Generate Optimized Route</h2>
                <p className="text-xs text-slate-500">
                  Select session collection tasks or supply Task UUIDs to compute stop sequence from depot.
                </p>
              </div>
            </div>

            {sessionTasks.length > 0 && (
              <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {sessionTasks.map((t) => {
                  const checked = selectedTaskIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-xs ${
                        checked ? 'border-[#047857] bg-emerald-50/60' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTask(t.id)}
                          className="accent-[#047857]"
                        />
                        <span className="font-mono font-medium text-slate-900">{t.bin_code}</span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {t.priority} · {t.status}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="manual-task-ids" className="block text-xs font-medium text-slate-700">
                Task UUIDs (comma-separated)
              </label>
              <input
                id="manual-task-ids"
                type="text"
                value={manualTaskIdsInput}
                onChange={(e) => setManualTaskIdsInput(e.target.value)}
                placeholder="uuid-1, uuid-2"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            <button
              type="button"
              disabled={isWorking}
              onClick={() => void handleOptimize()}
              className="w-full rounded-md bg-[#047857] px-4 py-2 text-xs font-medium text-white hover:bg-[#065F46] disabled:opacity-50"
            >
              {isWorking ? 'Optimizing…' : 'Optimize route'}
            </button>
          </div>

          {/* Round 3 Incident Replanning */}
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <GitBranch className="h-4 w-4 text-[#D97706]" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Round 3 Incident Replanning
                </h2>
                <p className="text-xs text-slate-500">
                  Preserves completed stops, reprioritizes overflow, and saves a new route version.
                </p>
              </div>
            </div>

            {sessionIncidents.length > 0 && (
              <div className="space-y-1.5">
                <label htmlFor="select-incident" className="block text-xs font-medium text-slate-700">
                  Session Incidents
                </label>
                <select
                  id="select-incident"
                  value={selectedIncidentId}
                  onChange={(e) => setSelectedIncidentId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
                >
                  {sessionIncidents.map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.type} ({inc.status}) — {inc.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="manual-inc-id" className="block text-xs font-medium text-slate-700">
                Incident UUID
              </label>
              <input
                id="manual-inc-id"
                type="text"
                value={manualIncidentId}
                onChange={(e) => setManualIncidentId(e.target.value)}
                placeholder="Paste Incident UUID"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
              />
            </div>

            <button
              type="button"
              disabled={isWorking || !activeRoute}
              onClick={() => void handleReplan()}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isWorking ? 'Replanning…' : 'Replan active route for incident'}
            </button>

            <form onSubmit={handleCreateIncident} className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ShieldAlert className="h-3.5 w-3.5 text-[#D97706]" />
                <span>Log New Operational Incident</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Incident type"
                  value={incType}
                  onChange={(e) => setIncType(e.target.value as IncidentType)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Incident severity"
                  value={incSeverity}
                  onChange={(e) => setIncSeverity(e.target.value as IncidentSeverity)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Affected bin"
                  value={incBinId}
                  onChange={(e) => setIncBinId(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs"
                >
                  <option value="">No specific bin</option>
                  {bins.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bin_code}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={incRoadEdge}
                  onChange={(e) => setIncRoadEdge(e.target.value)}
                  placeholder="Road edge ID (optional)"
                  className="rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs"
                />
              </div>
              <textarea
                rows={2}
                required
                maxLength={1000}
                value={incDesc}
                onChange={(e) => setIncDesc(e.target.value)}
                placeholder="Incident details (e.g., blocked street or sudden overflow)..."
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={isWorking || !incDesc.trim()}
                className="w-full rounded-md border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
              >
                Create incident
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
