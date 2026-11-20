import { AlertTriangle, CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react';
import type {
  BinStatus,
  Contamination,
  EstimatesSource,
  RecommendationConfidence,
  RecommendationStatus,
  RouteStatus,
  RouteStopStatus,
  TaskPriority,
  TaskStatus,
} from '../types/api';

type SemanticTone = 'nominal' | 'warning' | 'critical' | 'neutral';

function toneClasses(tone: SemanticTone): string {
  switch (tone) {
    case 'nominal':
      return 'text-[#16A34A]';
    case 'warning':
      return 'text-[#D97706]';
    case 'critical':
      return 'text-[#DC2626]';
    default:
      return 'text-slate-600';
  }
}

function ToneIcon({ tone }: { tone: SemanticTone }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (tone) {
    case 'nominal':
      return <CheckCircle2 className={cls} aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle className={cls} aria-hidden="true" />;
    case 'critical':
      return <XCircle className={cls} aria-hidden="true" />;
    default:
      return <MinusCircle className={cls} aria-hidden="true" />;
  }
}

export function BinStatusText({ status }: { status: BinStatus }) {
  const map: Record<BinStatus, { label: string; tone: SemanticTone }> = {
    ACTIVE: { label: 'Active', tone: 'nominal' },
    INACTIVE: { label: 'Inactive', tone: 'neutral' },
    DAMAGED: { label: 'Damaged', tone: 'critical' },
    RELOCATED: { label: 'Relocated', tone: 'warning' },
    DECOMMISSIONED: { label: 'Decommissioned', tone: 'neutral' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses(cfg.tone)}`}>
      <ToneIcon tone={cfg.tone} />
      <span>{cfg.label}</span>
    </span>
  );
}

export function TaskPriorityText({ priority }: { priority: TaskPriority }) {
  const map: Record<TaskPriority, { label: string; tone: SemanticTone }> = {
    LOW: { label: 'Low priority', tone: 'neutral' },
    NORMAL: { label: 'Normal', tone: 'neutral' },
    HIGH: { label: 'High priority', tone: 'warning' },
    CRITICAL: { label: 'Critical', tone: 'critical' },
  };
  const cfg = map[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses(cfg.tone)}`}>
      <ToneIcon tone={cfg.tone} />
      <span>{cfg.label}</span>
    </span>
  );
}

export function TaskStatusText({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; tone: SemanticTone }> = {
    PENDING: { label: 'Pending', tone: 'neutral' },
    ASSIGNED: { label: 'Assigned', tone: 'neutral' },
    IN_PROGRESS: { label: 'In progress', tone: 'warning' },
    COMPLETED: { label: 'Completed', tone: 'nominal' },
    PARTIAL: { label: 'Partial', tone: 'warning' },
    FAILED: { label: 'Failed', tone: 'critical' },
    CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses(cfg.tone)}`}>
      {status === 'PENDING' || status === 'ASSIGNED' ? (
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <ToneIcon tone={cfg.tone} />
      )}
      <span>{cfg.label}</span>
    </span>
  );
}

export function ContaminationText({ level }: { level: Contamination }) {
  const map: Record<Contamination, { label: string; tone: SemanticTone }> = {
    NONE: { label: 'None', tone: 'nominal' },
    LOW: { label: 'Low', tone: 'nominal' },
    MEDIUM: { label: 'Medium', tone: 'warning' },
    HIGH: { label: 'High', tone: 'critical' },
  };
  const cfg = map[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses(cfg.tone)}`}>
      <ToneIcon tone={cfg.tone} />
      <span>{cfg.label}</span>
    </span>
  );
}

export function RecommendationStatusText({ status }: { status: RecommendationStatus }) {
  const map: Record<RecommendationStatus, { label: string; tone: SemanticTone }> = {
    PENDING: { label: 'Pending review', tone: 'warning' },
    APPROVED: { label: 'Approved', tone: 'nominal' },
    REJECTED: { label: 'Rejected', tone: 'critical' },
    EDITED: { label: 'Edited', tone: 'nominal' },
    IMPLEMENTED: { label: 'Implemented', tone: 'nominal' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses(cfg.tone)}`}>
      <ToneIcon tone={cfg.tone} />
      <span>{cfg.label}</span>
    </span>
  );
}

export function ConfidenceText({ confidence }: { confidence?: RecommendationConfidence }) {
  if (!confidence) return null;
  const map: Record<RecommendationConfidence, { label: string; tone: SemanticTone }> = {
    LOW: { label: 'Low confidence', tone: 'warning' },
    MEDIUM: { label: 'Medium confidence', tone: 'neutral' },
    HIGH: { label: 'High confidence', tone: 'nominal' },
  };
  const cfg = map[confidence];
  return <span className={`text-xs font-medium ${toneClasses(cfg.tone)}`}>{cfg.label}</span>;
}

export function RouteStatusText({ status }: { status: RouteStatus }) {
  const map: Record<RouteStatus, { label: string; tone: SemanticTone }> = {
    DRAFT: { label: 'Draft', tone: 'neutral' },
    ACTIVE: { label: 'Active', tone: 'nominal' },
    COMPLETED: { label: 'Completed', tone: 'nominal' },
    FAILED: { label: 'Routing failed', tone: 'critical' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses(cfg.tone)}`}>
      <ToneIcon tone={cfg.tone} />
      <span>{cfg.label}</span>
    </span>
  );
}

export function RouteStopStatusText({ status }: { status: RouteStopStatus }) {
  const map: Record<RouteStopStatus, { label: string; tone: SemanticTone }> = {
    PENDING: { label: 'Pending', tone: 'neutral' },
    COMPLETED: { label: 'Completed', tone: 'nominal' },
    SKIPPED: { label: 'Skipped', tone: 'warning' },
    UNREACHABLE: { label: 'Unreachable', tone: 'critical' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses(cfg.tone)}`}>
      <ToneIcon tone={cfg.tone} />
      <span>{cfg.label}</span>
    </span>
  );
}

export function EstimatesSourceText({ source }: { source?: EstimatesSource }) {
  if (!source) return null;
  const map: Record<EstimatesSource, { label: string; tone: SemanticTone }> = {
    OSRM: { label: 'Road-network estimate (OSRM)', tone: 'nominal' },
    SIMULATED: { label: 'Simulated estimate', tone: 'warning' },
    UNAVAILABLE: { label: 'Estimates unavailable', tone: 'critical' },
  };
  const cfg = map[source];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses(cfg.tone)}`}>
      <ToneIcon tone={cfg.tone} />
      <span>{cfg.label}</span>
    </span>
  );
}
