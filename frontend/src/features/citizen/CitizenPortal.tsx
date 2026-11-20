import { CheckCircle2, Clock, Info, MapPin, QrCode, Recycle, ShieldCheck, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BinFeedback } from './BinFeedback';
import { useAuth } from '../../app/AuthContext';
import { LocalAccountId } from '../../components/LocalAccountId';
import { ENV_CONFIG } from '../../config/env';
import { ErrorBanner } from '../../components/ErrorBanner';
import { QrScannerPanel } from '../../components/QrScannerPanel';
import { BinStatusText } from '../../components/StatusText';
import { CATEGORY_CODES, CATEGORY_LABELS } from '../../constants/waste';
import { ApiClientError } from '../../services/apiClient';
import { citizenService, createIdempotencyKey } from '../../services/citizenService';
import type {
  CategoryCode,
  CooldownErrorPayload,
  DisposalEvent,
  PublicBin,
} from '../../types/api';

interface CitizenPortalProps {
  onOpenSignIn: () => void;
}

export function CitizenPortal({ onOpenSignIn }: CitizenPortalProps) {
  const { user, anonymousSession, ensureAnonymousSession } = useAuth();

  const [activeToken, setActiveToken] = useState<string>('');
  const [resolvedBin, setResolvedBin] = useState<PublicBin | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<unknown>(null);

  const [declaredCategory, setDeclaredCategory] = useState<CategoryCode | ''>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => createIdempotencyKey());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [lastEvent, setLastEvent] = useState<DisposalEvent | null>(null);

  // Presentation-only countdown synced from server 429 retry_after_seconds
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [cooldownBinCode, setCooldownBinCode] = useState<string | null>(null);

  const [history, setHistory] = useState<DisposalEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<unknown>(null);

  const isCitizenUser = user?.role === 'CITIZEN';

  const loadHistory = useCallback(async () => {
    if (!isCitizenUser) {
      setHistory([]);
      return;
    }
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await citizenService.getMyDisposalEvents();
      setHistory(res.items);
    } catch (err) {
      setHistoryError(err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isCitizenUser]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const handleResolveQr = async (qrToken: string) => {
    setResolveError(null);
    setSubmitError(null);
    setLastEvent(null);
    setIsResolving(true);
    try {
      const bin = await citizenService.resolveBinQr({ qr_token: qrToken });
      setActiveToken(qrToken);
      setResolvedBin(bin);
      setDeclaredCategory(bin.category_code);
      setIdempotencyKey(createIdempotencyKey());
      if (cooldownBinCode && cooldownBinCode !== bin.bin_code) {
        setCooldownSeconds(0);
        setCooldownBinCode(null);
      }
    } catch (err) {
      setResolvedBin(null);
      setActiveToken('');
      setResolveError(err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleRecordInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedBin || !activeToken) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      if (!user) {
        await ensureAnonymousSession();
      }
      const event = await citizenService.createDisposalEvent(
        {
          qr_token: activeToken,
          ...(declaredCategory ? { declared_category_code: declaredCategory } : {}),
        },
        idempotencyKey,
      );
      setLastEvent(event);
      setIdempotencyKey(createIdempotencyKey());
      setCooldownSeconds(0);
      setCooldownBinCode(null);
      if (isCitizenUser) {
        void loadHistory();
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429) {
        const payload = err.payload as CooldownErrorPayload;
        setCooldownSeconds(payload.retry_after_seconds);
        setCooldownBinCode(resolvedBin.bin_code);
      }
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#063b32] px-6 py-8 text-white shadow-xl sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Smarter campus waste operations
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              A cleaner campus starts with one scan.
            </h1>
            <p className="max-w-lg text-sm leading-6 text-emerald-50/80 sm:text-base">
              Find the right waste stream, check in at a bin, and help the campus team see what needs attention next.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-emerald-50/90">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><QrCode className="h-3.5 w-3.5" /> Scan a bin</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><Recycle className="h-3.5 w-3.5" /> Sort with confidence</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><MapPin className="h-3.5 w-3.5" /> GreenTrack Network</span>
            </div>
          </div>
          <div className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64" aria-hidden="true">
            <div className="absolute inset-5 rounded-full border border-emerald-200/20 bg-gradient-to-br from-emerald-300/30 to-cyan-300/5 shadow-[0_0_80px_rgba(52,211,153,0.25)] backdrop-blur-sm" />
            <div className="absolute inset-12 rounded-full border border-white/20 bg-white/10 shadow-inner backdrop-blur-md" />
            <button
              type="button"
              onClick={() => document.getElementById('greentrack-scanner')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="gt-interactive absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 rotate-6 items-center justify-center rounded-2xl border border-white/30 bg-white text-[#047857] shadow-2xl hover:rotate-0 hover:shadow-emerald-300/30"
              aria-label="Open QR scanner"
            >
              <QrCode className="h-11 w-11" />
            </button>
            <div className="absolute right-0 top-8 rounded-xl border border-white/20 bg-slate-950/30 px-3 py-2 text-[11px] font-medium shadow-lg backdrop-blur-md">Real-time signals</div>
            <div className="absolute bottom-5 left-0 rounded-xl border border-white/20 bg-slate-950/30 px-3 py-2 text-[11px] font-medium shadow-lg backdrop-blur-md">Campus-ready</div>
          </div>
        </div>
      </section>
      {ENV_CONFIG.defaultUseMockApi && isCitizenUser && user && <LocalAccountId key={user.id} accountId={user.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="gt-interactive rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Your check-ins</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{history.length}</p>
          <p className="mt-1 text-xs text-slate-500">Recorded participation events</p>
        </div>
        <div className="gt-interactive rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Scan status</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">Ready</p>
          <p className="mt-1 text-xs text-slate-500">Camera or token entry available</p>
        </div>
        <div className="gt-interactive rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Identity</p>
          <p className="mt-2 truncate text-lg font-semibold text-slate-900">{isCitizenUser ? 'Signed in' : 'Anonymous'}</p>
          <p className="mt-1 text-xs text-slate-500">{isCitizenUser ? 'History is saved to your account' : 'Sign in to save your history'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="max-w-2xl space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Citizen Bin Check-In &amp; Disposal Guidance
          </h1>
          <p className="text-sm text-slate-600">
            Scan a bin QR sticker to verify its assigned waste stream and record a participation interaction.
          </p>
        </div>
        <div className="text-xs text-slate-600">
          {isCitizenUser && user ? (
            <span>
              Signed in as <strong className="font-medium text-slate-900">{user.display_name}</strong>
            </span>
          ) : anonymousSession ? (
            <span>
              Anonymous session active ·{' '}
              <button
                type="button"
                onClick={onOpenSignIn}
                className="font-medium text-[#047857] underline-offset-2 hover:underline"
              >
                Sign in to save history
              </button>
            </span>
          ) : (
            <span>
              No login required ·{' '}
              <button
                type="button"
                onClick={onOpenSignIn}
                className="font-medium text-[#047857] underline-offset-2 hover:underline"
              >
                Sign in for personal history
              </button>
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-6">
          <div id="greentrack-scanner" className="scroll-mt-28">
            <QrScannerPanel
              centered
              onResolve={handleResolveQr}
              isResolving={isResolving}
              title="Scan Bin QR Code"
              description="Scan with your camera or enter the bin code below."
            />
          </div>

          <ErrorBanner
            error={resolveError}
            onDismiss={() => setResolveError(null)}
            title="QR resolution failed"
          />

          {resolvedBin ? (
            <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{resolvedBin.zone_name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{CATEGORY_LABELS[resolvedBin.category_code]}</span>
                  </div>
                  <h2 className="font-mono text-xl font-semibold text-slate-900">
                    {resolvedBin.bin_code}
                  </h2>
                </div>
                <BinStatusText status={resolvedBin.status} />
              </div>

              {resolvedBin.disposal_guidance && (
                <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" aria-hidden="true" />
                  <p>{resolvedBin.disposal_guidance}</p>
                </div>
              )}

              <BinFeedback key={resolvedBin.bin_id} id={resolvedBin.bin_id} bin={resolvedBin.bin_code} />
              <form onSubmit={handleRecordInteraction} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Declared waste stream (optional citizen declaration — not verified physical content)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORY_CODES.map((cat) => {
                      const active = declaredCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setDeclaredCategory(cat)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'border-[#047857] bg-emerald-50 text-[#047857]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {CATEGORY_LABELS[cat]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-500">
                    Records participation only — does not verify deposit or measure bin fill.
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting || resolvedBin.status !== 'ACTIVE'}
                    className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#065F46] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{isSubmitting ? 'Recording…' : 'Record disposal interaction'}</span>
                  </button>
                </div>
              </form>

              {cooldownSeconds > 0 && (
                <div className="flex items-center justify-between gap-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-[#D97706]" aria-hidden="true" />
                    <div>
                      <p className="font-medium">
                        Cooldown active on {cooldownBinCode ?? resolvedBin.bin_code}
                      </p>
                      <p className="text-xs text-amber-800">
                        Presentation timer only — the server enforces the 5-minute cooldown per actor and bin. Other bins remain independent.
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-base font-semibold text-amber-900 tabular-nums">
                    {formatCountdown(cooldownSeconds)}
                  </span>
                </div>
              )}

              <ErrorBanner
                error={submitError}
                onDismiss={() => setSubmitError(null)}
                title="Interaction not accepted"
              />

              {lastEvent && (
                <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" aria-hidden="true" />
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      Interaction accepted on <span className="font-mono">{lastEvent.bin_code}</span>
                    </p>
                    <p className="text-xs text-emerald-900">
                      Recorded at{' '}
                      <span className="font-mono tabular-nums">
                        {new Date(lastEvent.accepted_at).toLocaleString()}
                      </span>{' '}
                      · Participation event only
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
              <QrCode className="mb-2.5 h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-800">No bin selected yet</p>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Scan a bin QR sticker or enter its code above to view disposal instructions and check in.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Your Participation History</h2>
                <p className="text-xs text-slate-500">
                  Logged-in citizen interactions · Participation record only
                </p>
              </div>
              {isCitizenUser && (
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Refresh
                </button>
              )}
            </div>

            {!isCitizenUser ? (
              <div className="space-y-3 py-4 text-sm text-slate-600">
                <p>
                  You are interacting without a signed-in citizen account. Anonymous sessions allow bin check-ins with server cooldown enforcement, while registered sign-in stores your personal interaction history.
                </p>
                <button
                  type="button"
                  onClick={onOpenSignIn}
                  className="rounded-md bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Sign in as Citizen
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <ErrorBanner error={historyError} onDismiss={() => setHistoryError(null)} />
                {isLoadingHistory ? (
                  <div className="space-y-2 py-2">
                    <div className="h-9 animate-pulse rounded bg-slate-100" />
                    <div className="h-9 animate-pulse rounded bg-slate-100" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">
                    No disposal interactions recorded under this account yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3 font-medium">Bin</th>
                          <th className="py-2 pr-3 font-medium">Declared</th>
                          <th className="py-2 text-right font-medium">Accepted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2.5 pr-3 font-mono font-medium text-slate-900">
                              {item.bin_code}
                            </td>
                            <td className="py-2.5 pr-3 text-slate-600">
                              {item.declared_category_code
                                ? CATEGORY_LABELS[item.declared_category_code]
                                : 'Unspecified'}
                            </td>
                            <td className="py-2.5 text-right font-mono text-slate-500 tabular-nums">
                              {new Date(item.accepted_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
