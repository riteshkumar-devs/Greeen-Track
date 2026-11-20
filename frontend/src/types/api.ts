export type Role = 'CITIZEN' | 'COLLECTOR' | 'ADMIN';

export type CategoryCode = 'WET' | 'PLASTIC' | 'PAPER' | 'METAL_GLASS' | 'OTHER';

export type BinStatus = 'ACTIVE' | 'INACTIVE' | 'DAMAGED' | 'RELOCATED' | 'DECOMMISSIONED';

export type TaskStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type TaskOutcome = 'COMPLETED' | 'PARTIAL' | 'FAILED';

export type Contamination = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type IncidentType = 'OVERFLOW' | 'BLOCKED_ROAD' | 'BLOCKED_ACCESS' | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type InspectionSource = 'REAL' | 'SIMULATED';

export type ZoneStatus = 'ACTIVE' | 'INACTIVE';

export type CollectorStatus = 'ACTIVE' | 'INACTIVE';

export type RecommendationActionType =
  | 'ADD_BIN'
  | 'RELOCATE_BIN'
  | 'CHANGE_CATEGORY_MIX'
  | 'INCREASE_COLLECTION_FREQUENCY'
  | 'INCREASE_INSPECTION_FREQUENCY'
  | 'SEGREGATION_AWARENESS';

export type RecommendationConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EDITED' | 'IMPLEMENTED';

export type RecommendationDecisionType = 'APPROVE' | 'REJECT' | 'EDIT';

export type RouteStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export type RouteStopStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'UNREACHABLE';

export type EstimatesSource = 'OSRM' | 'SIMULATED' | 'UNAVAILABLE';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface CooldownErrorPayload {
  code: 'COOLDOWN_ACTIVE';
  message: string;
  retry_after_seconds: number;
}

export interface Health {
  status: 'ok';
  service: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserSummary {
  id: string;
  role: Role;
  display_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_at?: string;
  user: UserSummary;
}

export interface Me {
  user: UserSummary;
}

export interface AnonymousSession {
  session_token: string;
  expires_at: string;
}

export interface ResolveBinRequest {
  qr_token: string;
}

export interface PublicBin {
  bin_id: string;
  bin_code: string;
  category_code: CategoryCode;
  zone_name: string;
  status: BinStatus;
  disposal_guidance?: string;
}

export interface CreateDisposalEvent {
  qr_token: string;
  declared_category_code?: CategoryCode;
}

export interface DisposalEvent {
  id: string;
  bin_id: string;
  bin_code: string;
  accepted_at: string;
  event_type: 'DISPOSAL_INTERACTION';
  declared_category_code?: CategoryCode | null;
}

export interface DisposalEventList {
  items: DisposalEvent[];
}

export interface CreateInspection {
  fill_percent: number;
  overflow: boolean;
  observed_category_code: CategoryCode;
  contamination_level: Contamination;
  estimated_mixed_percent?: number | null;
  notes?: string;
  photo_url?: string | null;
  source: InspectionSource;
}

export interface Inspection {
  id: string;
  bin_id: string;
  collector_id: string;
  fill_percent: number;
  overflow: boolean;
  observed_category_code?: CategoryCode;
  contamination_level: Contamination;
  estimated_mixed_percent?: number | null;
  inspected_at: string;
  source: InspectionSource;
}

export interface CompleteTask {
  outcome: TaskOutcome;
  notes?: string;
  post_collection_fill_percent?: number | null;
  exception_reason?: string | null;
}

export interface Task {
  id: string;
  bin_id: string;
  bin_code: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_at?: string | null;
}

export interface TaskList {
  items: Task[];
}

export interface CreateZone {
  name: string;
  description?: string;
  center?: Coordinate;
}

export interface UpdateZone {
  name?: string;
  description?: string;
  status?: ZoneStatus;
}

export interface Zone {
  id: string;
  name: string;
  description?: string;
  status: ZoneStatus;
  center?: Coordinate;
}

export interface ZoneList {
  items: Zone[];
}

export interface CreateBin {
  bin_code: string;
  zone_id: string;
  category_code: CategoryCode;
  capacity_litres: number;
  location: Coordinate;
}

export interface UpdateBin {
  zone_id?: string;
  category_code?: CategoryCode;
  capacity_litres?: number;
  location?: Coordinate;
  status?: BinStatus;
}

export interface Bin {
  id: string;
  bin_code: string;
  zone_id: string;
  category_code: CategoryCode;
  capacity_litres: number;
  location: Coordinate;
  status: BinStatus;
  latest_observed_fill_percent?: number | null;
  latest_inspected_at?: string | null;
}

export interface BinList {
  items: Bin[];
}

export interface BinCreated {
  bin: Bin;
  qr_token: string;
  qr_payload: string;
}

export interface QrRotation {
  bin_id: string;
  qr_token: string;
  qr_payload: string;
  rotated_at: string;
}

export interface CreateCollector {
  display_name: string;
  email: string;
  zone_ids?: string[];
}

export interface UpdateCollector {
  status?: CollectorStatus;
  zone_ids?: string[];
}

export interface Collector {
  id: string;
  display_name: string;
  email: string;
  status: CollectorStatus;
  zone_ids?: string[];
}

export interface CollectorList {
  items: Collector[];
}

export interface CreateTask {
  bin_id: string;
  assigned_collector_id?: string | null;
  priority: TaskPriority;
  due_at?: string | null;
  reason?: string;
}

export interface GenerateMonthly {
  period: string;
  include_simulated?: boolean;
}

export interface Metric {
  name: string;
  value: number;
  unit?: string;
  sample_count: number;
  coverage_percent?: number | null;
}

export interface ZoneSummary {
  zone_id: string;
  zone_name: string;
  hotspot_score: number;
  data_coverage_percent: number;
  observed_avg_fill_percent?: number | null;
  overflow_count?: number;
}

export interface MonthlyAnalytics {
  period: string;
  generated_at: string;
  metrics: Metric[];
  zone_summaries: ZoneSummary[];
}

export interface RecommendationDecision {
  decision: RecommendationDecisionType;
  admin_notes?: string;
  edited_quantity?: number | null;
}

export interface Recommendation {
  id: string;
  period: string;
  zone_id?: string | null;
  bin_id?: string | null;
  action_type: RecommendationActionType;
  rationale: string;
  evidence_summary?: string;
  confidence?: RecommendationConfidence;
  status: RecommendationStatus;
}

export interface RecommendationList {
  items: Recommendation[];
}

export interface CreateIncident {
  type: IncidentType;
  bin_id?: string | null;
  road_edge_id?: string | null;
  location?: Coordinate;
  severity: IncidentSeverity;
  description: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  status: IncidentStatus;
  reported_at: string;
}

export interface OptimizeRoute {
  task_ids: string[];
  depot: Coordinate;
  vehicle_id?: string | null;
}

export interface ReplanRoute {
  incident_id: string;
}

export interface RouteStop {
  sequence: number;
  bin_id: string;
  bin_code: string;
  status: RouteStopStatus;
}

export interface Route {
  id: string;
  version: number;
  status: RouteStatus;
  distance_estimate_km?: number | null;
  duration_estimate_minutes?: number | null;
  estimates_source?: EstimatesSource;
  affected_bin_ids?: string[];
  stops: RouteStop[];
}
