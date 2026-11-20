import { BarChart3, Check, Edit3, Info, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfidenceText, RecommendationStatusText } from '../../components/StatusText';
import { analyticsService } from '../../services/analyticsService';
import type {
  MonthlyAnalytics,
  Recommendation,
  RecommendationDecisionType,
} from '../../types/api';

export function AnalyticsView() {
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [includeSimulated, setIncludeSimulated] = useState(false);

  const [analytics, setAnalytics] = useState<MonthlyAnalytics | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Edit / decision modal state per recommendation
  const [activeRecId, setActiveRecId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [editedQty, setEditedQty] = useState<string>('');
  const [isDeciding, setIsDeciding] = useState(false);

  const loadSnapshotAndRecs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [aRes, rRes] = await Promise.all([
        analyticsService.getMonthlyAnalytics(period),
        analyticsService.listRecommendations(period),
      ]);
      setAnalytics(aRes);
      setRecommendations(rRes.items);
    } catch (err) {
      setAnalytics(null);
      setError(err);
      try {
        const rRes = await analyticsService.listRecommendations(period);
        setRecommendations(rRes.items);
      } catch {
        setRecommendations([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadSnapshotAndRecs();
  }, [loadSnapshotAndRecs]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await analyticsService.generateMonthlyAnalytics({
        period,
        include_simulated: includeSimulated,
      });
      setAnalytics(generated);
      const rRes = await analyticsService.listRecommendations(period);
      setRecommendations(rRes.items);
    } catch (err) {
      setError(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDecision = async (recId: string, decision: RecommendationDecisionType) => {
    setIsDeciding(true);
    setError(null);
    try {
      const updated = await analyticsService.decideRecommendation(recId, {
        decision,
        admin_notes: adminNotes.trim() || undefined,
        edited_quantity:
          decision === 'EDIT' && editedQty.trim() !== '' ? Number(editedQty.trim()) : null,
      });
      setRecommendations((prev) => prev.map((r) => (r.id === recId ? updated : r)));
      setActiveRecId(null);
      setAdminNotes('');
      setEditedQty('');
    } catch (err) {
      setError(err);
    } finally {
      setIsDeciding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="analytics-period" className="text-xs font-medium text-slate-700">
            Reporting Month
          </label>
          <input
            id="analytics-period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900"
          />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={includeSimulated}
              onChange={(e) => setIncludeSimulated(e.target.checked)}
              className="accent-[#D97706]"
            />
            <span>Include SIMULATED demo inspections</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadSnapshotAndRecs()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Load snapshot</span>
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#047857] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#065F46] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>{isGenerating ? 'Generating…' : 'Generate monthly snapshot'}</span>
          </button>
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {/* Evidence Disclosure Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" aria-hidden="true" />
        <p>
          Monthly metrics separate physical inspection evidence (fill, overflow, contamination) from citizen QR participation counts. Hotspot scores reflect a baseline heuristic (40% fill pressure, 30% overflow burden, 20% collection pressure, 10% complaint burden reweighted when unavailable) and always display sample counts and bin coverage.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
          ))}
        </div>
      ) : analytics ? (
        <>
          {/* Metrics Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {analytics.metrics.map((m) => (
              <div key={m.name} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">{m.name}</p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {m.value}
                  </span>
                  {m.unit && <span className="text-xs text-slate-500">{m.unit}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
                  <span>n={m.sample_count}</span>
                  {m.coverage_percent !== null && m.coverage_percent !== undefined && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{m.coverage_percent}% coverage</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Zone Summaries Chart & Table */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Zone Hotspot Score vs Observed Average Fill
                  </h2>
                  <p className="text-xs text-slate-500">
                    Snapshot generated{' '}
                    <span className="font-mono tabular-nums">
                      {new Date(analytics.generated_at).toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.zone_summaries}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="zone_name" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip
                      contentStyle={{
                        fontSize: '12px',
                        borderRadius: '8px',
                        borderColor: '#E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="hotspot_score"
                      name="Hotspot Score (0-100)"
                      fill="#047857"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="observed_avg_fill_percent"
                      name="Observed Avg Fill (%)"
                      fill="#0F172A"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white lg:col-span-5">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Zone Coverage &amp; Overflows</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2 font-medium">Zone</th>
                      <th className="px-3.5 py-2 text-right font-medium">Hotspot</th>
                      <th className="px-3.5 py-2 text-right font-medium">Coverage</th>
                      <th className="px-3.5 py-2 text-right font-medium">Overflows</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.zone_summaries.map((z) => (
                      <tr key={z.zone_id}>
                        <td className="px-3.5 py-2.5 font-medium text-slate-900">{z.zone_name}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-slate-900 tabular-nums">
                          {z.hotspot_score}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                          {z.data_coverage_percent}%
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-slate-900 tabular-nums">
                          {z.overflow_count ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-800">No monthly snapshot found for {period}</p>
          <p className="mt-1 text-xs text-slate-500">
            Click &ldquo;Generate monthly snapshot&rdquo; above to compute metrics and candidate recommendations from inspection history.
          </p>
        </div>
      )}

      {/* Recommendations Review Queue */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Infrastructure &amp; Operations Recommendations ({period})
          </h2>
          <p className="text-xs text-slate-500">
            Rule-based baseline recommendations requiring explicit admin review before execution.
          </p>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            No candidate recommendations available for {period}.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {recommendations.map((rec) => {
              const isEditing = activeRecId === rec.id;
              return (
                <div key={rec.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-900">
                          {rec.action_type}
                        </span>
                        <span aria-hidden="true">·</span>
                        <ConfidenceText confidence={rec.confidence} />
                      </div>
                      <p className="text-sm text-slate-800">{rec.rationale}</p>
                      {rec.evidence_summary && (
                        <p className="text-xs text-slate-500">Evidence: {rec.evidence_summary}</p>
                      )}
                    </div>
                    <RecommendationStatusText status={rec.status} />
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-slate-700">
                            Edited Quantity (optional)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={editedQty}
                            onChange={(e) => setEditedQty(e.target.value)}
                            placeholder="e.g. 2"
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700">
                            Admin Decision Notes
                          </label>
                          <input
                            type="text"
                            maxLength={1000}
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Rationale for approval, edit, or rejection"
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isDeciding}
                          onClick={() => void handleDecision(rec.id, 'APPROVE')}
                          className="inline-flex items-center gap-1 rounded-md bg-[#047857] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#065F46]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          disabled={isDeciding}
                          onClick={() => void handleDecision(rec.id, 'EDIT')}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Save edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={isDeciding}
                          onClick={() => void handleDecision(rec.id, 'REJECT')}
                          className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveRecId(null)}
                          className="ml-auto text-xs text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleDecision(rec.id, 'APPROVE')}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-[#047857] hover:bg-emerald-100 whitespace-nowrap shrink-0"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRecId(rec.id);
                          setAdminNotes('');
                          setEditedQty('');
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit / Add note</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecision(rec.id, 'REJECT')}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
