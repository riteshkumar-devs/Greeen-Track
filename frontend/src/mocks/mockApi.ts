import type {
  AnonymousSession,
  ApiErrorPayload,
  AuthResponse,
  Bin,
  BinCreated,
  BinList,
  BinStatus,
  CategoryCode,
  Collector,
  CollectorList,
  CompleteTask,
  CooldownErrorPayload,
  CreateBin,
  CreateCollector,
  CreateDisposalEvent,
  CreateIncident,
  CreateInspection,
  CreateTask,
  CreateZone,
  DisposalEvent,
  DisposalEventList,
  GenerateMonthly,
  Health,
  Incident,
  Inspection,
  LoginRequest,
  Me,
  MonthlyAnalytics,
  OptimizeRoute,
  PublicBin,
  QrRotation,
  Recommendation,
  RecommendationDecision,
  RecommendationList,
  ReplanRoute,
  ResolveBinRequest,
  Route,
  Task,
  TaskList,
  TaskStatus,
  UpdateBin,
  UpdateCollector,
  UpdateZone,
  Zone,
  ZoneList,
} from '../types/api';
import { DISPOSAL_GUIDANCE } from '../constants/waste';
import {
  DEMO_USERS,
  type DemoUserRecord,
  type InternalIncidentRecord,
  type InternalTaskRecord,
  type QrCredentialRecord,
} from './seedData';

export class ApiClientError extends Error {
  status: number;
  payload: ApiErrorPayload | CooldownErrorPayload;

  constructor(status: number, payload: ApiErrorPayload | CooldownErrorPayload) {
    super(payload.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

interface MockState {
  users: DemoUserRecord[];
  anonymousSessions: Record<string, { id: string; expires_at: string }>;
  zones: Zone[];
  bins: Bin[];
  qrCredentials: QrCredentialRecord[];
  collectors: Collector[];
  tasks: InternalTaskRecord[];
  inspections: Inspection[];
  disposalEvents: (DisposalEvent & { actor_id: string })[];
  cooldowns: Record<string, number>; // `${actorKey}::${bin_id}` -> epoch ms next_allowed_at
  idempotencyCache: Record<string, DisposalEvent>;
  incidents: InternalIncidentRecord[];
  routes: Route[];
  monthlyAnalytics: Record<string, MonthlyAnalytics>;
  recommendations: Recommendation[];
}

const STORAGE_KEY = 'greentrack_mock_state_v2';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInitialState(): MockState {
  const collectors = DEMO_USERS.filter(user => user.role === 'COLLECTOR').map(user => ({
    id: user.id, display_name: user.display_name, email: user.email,
    status: 'ACTIVE' as const, zone_ids: [],
  }));
  return {
    users: clone(DEMO_USERS),
    anonymousSessions: {},
    zones: [],
    bins: [],
    qrCredentials: [],
    collectors,
    tasks: [],
    inspections: [],
    disposalEvents: [],
    cooldowns: {},
    idempotencyCache: {},
    incidents: [],
    routes: [],
    monthlyAnalytics: {},
    recommendations: [],
  };
}

// IDs of the records shipped in the first release, used only to clean old browser data.
const oldSampleIds = new Set([
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222203',
  '33333333-3333-4333-8333-333333333301',
  '33333333-3333-4333-8333-333333333302',
  '33333333-3333-4333-8333-333333333303',
  '33333333-3333-4333-8333-333333333304',
  '33333333-3333-4333-8333-333333333305',
  '33333333-3333-4333-8333-333333333306',
  '44444444-4444-4444-8444-444444444402',
  '55555555-5555-4555-8555-555555555501',
  '55555555-5555-4555-8555-555555555502',
  '55555555-5555-4555-8555-555555555503',
  '55555555-5555-4555-8555-555555555504',
  '55555555-5555-4555-8555-555555555505',
  '66666666-6666-4666-8666-666666666601',
  '66666666-6666-4666-8666-666666666602',
  '66666666-6666-4666-8666-666666666603',
  '77777777-7777-4777-8777-777777777701',
  '77777777-7777-4777-8777-777777777702',
  '88888888-8888-4888-8888-888888888801',
  '88888888-8888-4888-8888-888888888802',
  '99999999-9999-4999-8999-999999999901',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
]);

function migrateOldState(previous: MockState): MockState {
  const entered = (row: { id: string }) => !oldSampleIds.has(row.id);
  const tasks = previous.tasks.filter(entered);
  const inspections = previous.inspections.filter(entered);
  const disposalEvents = previous.disposalEvents.filter(entered);
  const incidents = previous.incidents.filter(entered);
  const routes = previous.routes.filter(entered);
  const recommendations = previous.recommendations.filter(entered);
  // Keep infrastructure referenced by a user's own work to avoid orphaning it.
  const usedBins = new Set([
    ...tasks, ...inspections, ...disposalEvents, ...incidents, ...recommendations,
    ...routes.flatMap(route => route.stops),
  ].map(row => row.bin_id));
  const bins = previous.bins.filter(bin => entered(bin) || usedBins.has(bin.id));
  const binIds = new Set(bins.map(bin => bin.id));
  const usedZones = new Set([...bins, ...recommendations].map(row => row.zone_id));
  const zones = previous.zones.filter(zone => entered(zone) || usedZones.has(zone.id));
  const zoneIds = new Set(zones.map(zone => zone.id));
  const assigned = new Set(tasks.map(task => task.assigned_collector_id));
  return {
    ...previous, bins, zones, tasks, inspections, disposalEvents, incidents, routes, recommendations,
    collectors: previous.collectors.filter(c => entered(c) || assigned.has(c.id))
      .map(c => ({ ...c, zone_ids: (c.zone_ids ?? []).filter(id => zoneIds.has(id)) })),
    qrCredentials: previous.qrCredentials.filter(qr => binIds.has(qr.bin_id)),
    cooldowns: Object.fromEntries(Object.entries(previous.cooldowns)
      .filter(([key]) => binIds.has(key.split('::').pop() ?? ''))),
    idempotencyCache: Object.fromEntries(Object.entries(previous.idempotencyCache)
      .filter(([, event]) => entered(event) && binIds.has(event.bin_id))),
    monthlyAnalytics: Object.fromEntries(Object.entries(previous.monthlyAnalytics)
      .filter(([, report]) => report.generated_at !== '2026-11-19T18:00:00Z'
        && !report.zone_summaries.some(zone => oldSampleIds.has(zone.zone_id)))),
  };
}

function loadState(): MockState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
    const legacy = window.localStorage.getItem('greentrack_mock_state_v1');
    if (!legacy) return createInitialState();
    const migrated = migrateOldState(JSON.parse(legacy) as MockState);
    saveState(migrated);
    return migrated;
  } catch {
    return createInitialState();
  }
}

function saveState(state: MockState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues in restricted environments
  }
}

let state: MockState = loadState();

export function resetMockState(): void {
  state = createInitialState();
  saveState(state);
}

export function localTaskStops(headers: Record<string, string>) {
  const user = requireUser(headers, ['COLLECTOR']);
  const assigned = new Set(state.tasks.filter(t => t.assigned_collector_id === user.id && ['PENDING','ASSIGNED','IN_PROGRESS'].includes(t.status)).map(t => t.bin_id));
  return state.bins.filter(b => assigned.has(b.id)).map(b => ({ code: b.bin_code, point: b.location }));
}

export function readActiveLocalQr(binId: string, headers: Record<string, string>) {
  requireUser(headers, ['ADMIN']);
  const active = state.qrCredentials.find(qr => qr.bin_id === binId && qr.active);
  return active ? { qr_token: active.qr_token, qr_payload: active.qr_payload } : null;
}

export function getMockSnapshotForFixtures() {
  return {
    qrTokens: state.qrCredentials.map((q) => ({
      bin_id: q.bin_id,
      bin_code: state.bins.find((b) => b.id === q.bin_id)?.bin_code ?? 'UNKNOWN',
      qr_token: q.qr_token,
      active: q.active,
    })),
    tasks: clone(state.tasks),
    incidents: clone(state.incidents),
    routes: clone(state.routes.map((r) => ({ id: r.id, version: r.version, status: r.status }))),
  };
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateQrToken(binCode: string): { qr_token: string; qr_payload: string } {
  const slug = binCode.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const randomSuffix = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8);
  const qr_token = `gt_qr_${slug}_${randomSuffix}`.padEnd(24, '0');
  return {
    qr_token,
    qr_payload: `https://greentrack.local/bin?t=${qr_token}`,
  };
}

function delay(ms = 140): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hashPassword(password: string, salt: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 600000 }, key, 256);
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export async function registerLocalCitizen(address: string, password: string) {
  const email = address.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) throw new Error('Enter a valid email and a password of at least 8 characters.');
  const passwordSalt = crypto.randomUUID();
  const passwordHash = await hashPassword(password, passwordSalt);
  state = loadState();
  if ([...state.users, ...state.collectors].some(u => u.email.toLowerCase() === email)) throw new Error('That email is already registered.');
  const id = crypto.randomUUID();
  const display_name = 'GT-' + id.replaceAll('-', '').slice(0, 16).toUpperCase();
  const account: DemoUserRecord = { id, display_name, email, passwordSalt, passwordHash, role: 'CITIZEN' };
  const next = { ...state, users: [...state.users, account] };
  localStorage.setItem('greentrack_profile_id_' + id, display_name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  state = next;
}

export async function provisionLocalCollector(headers: Record<string, string>, input: CreateCollector, password: string, existingId?: string) {
  requireUser(headers, ['ADMIN']);
  if (password.length < 8) throw new Error('Use at least 8 characters for the password.');
  const email = input.email.trim().toLowerCase();
  const salt = crypto.randomUUID();
  const hash = await hashPassword(password, salt);
  if ([...state.users, ...state.collectors].some(row => row.email.toLowerCase() === email && row.id !== existingId)) {
    throw new Error('This email is already registered.');
  }
  if (existingId && !state.collectors.some(c => c.id === existingId)) throw new Error('Collector no longer exists.');
  const collector: Collector = existingId ? state.collectors.find(c => c.id === existingId)! :
    { id: uuid(), display_name: input.display_name.trim(), email, status: 'ACTIVE', zone_ids: input.zone_ids ?? [] };
  const account: DemoUserRecord = { id: collector.id, display_name: collector.display_name, email, role: 'COLLECTOR', passwordHash: hash, passwordSalt: salt };
  const updated = { ...state, collectors: existingId ? state.collectors : [...state.collectors, collector],
    users: [...state.users.filter(u => u.id !== collector.id), account] };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  state = updated;
  return clone(collector);
}

function parseBearerUser(headers: Record<string, string>): DemoUserRecord | null {
  const auth = headers['Authorization'] || headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  if (!token.startsWith('mock_jwt_')) return null;
  const userId = token.slice('mock_jwt_'.length);
  return state.users.find((u) => u.id === userId) ?? null;
}

function requireUser(headers: Record<string, string>, allowedRoles?: DemoUserRecord['role'][]): DemoUserRecord {
  const user = parseBearerUser(headers);
  if (!user) {
    throw new ApiClientError(401, {
      code: 'UNAUTHORIZED',
      message: 'Authentication token is missing or invalid.',
    });
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new ApiClientError(403, {
      code: 'FORBIDDEN',
      message: `Role ${user.role} does not have permission for this operation.`,
    });
  }
  return user;
}

function resolveActor(headers: Record<string, string>): { actorType: 'USER' | 'ANONYMOUS'; actorId: string; role?: DemoUserRecord['role'] } {
  const user = parseBearerUser(headers);
  if (user) {
    return { actorType: 'USER', actorId: user.id, role: user.role };
  }
  const anonToken = headers['X-Anonymous-Session'] || headers['x-anonymous-session'];
  if (anonToken && state.anonymousSessions[anonToken]) {
    const sess = state.anonymousSessions[anonToken];
    if (new Date(sess.expires_at).getTime() > Date.now()) {
      return { actorType: 'ANONYMOUS', actorId: sess.id };
    }
  }
  throw new ApiClientError(401, {
    code: 'UNAUTHORIZED',
    message: 'Citizen Bearer token or valid X-Anonymous-Session header is required.',
  });
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function handleMockRequest<T>(
  method: string,
  pathWithQuery: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<T> {
  await delay();
  const headers = options.headers ?? {};
  const [path, queryString] = pathWithQuery.split('?');
  const query = new URLSearchParams(queryString ?? '');
  const upperMethod = method.toUpperCase();

  // GET /health
  if (upperMethod === 'GET' && path === '/health') {
    return { status: 'ok', service: 'greentrack-api (mock)' } satisfies Health as T;
  }

  // POST /auth/anonymous-sessions
  if (upperMethod === 'POST' && path === '/auth/anonymous-sessions') {
    const token = `anon_${uuid().replace(/-/g, '')}`;
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    state.anonymousSessions[token] = { id: uuid(), expires_at };
    saveState(state);
    return { session_token: token, expires_at } satisfies AnonymousSession as T;
  }

  // POST /auth/login
  if (upperMethod === 'POST' && path === '/auth/login') {
    const req = options.body as LoginRequest;
    const found = state.users.find(
      (u) => u.email.toLowerCase() === req.email?.trim().toLowerCase(),
    );
    const valid = found && typeof req.password === 'string' && (found.passwordSalt
      ? await hashPassword(req.password, found.passwordSalt) === found.passwordHash
      : found.password === req.password);
    if (!found || !valid || (found.role === 'COLLECTOR' && state.collectors.some(c => c.id === found.id && c.status === 'INACTIVE'))) {
      throw new ApiClientError(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }
    return {
      access_token: `mock_jwt_${found.id}`,
      token_type: 'Bearer',
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      user: {
        id: found.id,
        role: found.role,
        display_name: found.display_name,
      },
    } satisfies AuthResponse as T;
  }

  // GET /me
  if (upperMethod === 'GET' && path === '/me') {
    const user = requireUser(headers);
    return {
      user: {
        id: user.id,
        role: user.role,
        display_name: user.display_name,
      },
    } satisfies Me as T;
  }

  // POST /public/bins/resolve
  if (upperMethod === 'POST' && path === '/public/bins/resolve') {
    const req = options.body as ResolveBinRequest;
    if (!req?.qr_token || req.qr_token.trim().length < 20) {
      throw new ApiClientError(422, {
        code: 'VALIDATION_ERROR',
        message: 'qr_token must be at least 20 characters.',
      });
    }
    const cred = state.qrCredentials.find((c) => c.qr_token === req.qr_token.trim() && c.active);
    if (!cred) {
      throw new ApiClientError(404, {
        code: 'QR_NOT_FOUND_OR_REVOKED',
        message: 'This QR credential is unknown or has been revoked.',
      });
    }
    const bin = state.bins.find((b) => b.id === cred.bin_id);
    if (!bin) {
      throw new ApiClientError(404, { code: 'BIN_NOT_FOUND', message: 'Associated bin not found.' });
    }
    const zone = state.zones.find((z) => z.id === bin.zone_id);
    return {
      bin_id: bin.id,
      bin_code: bin.bin_code,
      category_code: bin.category_code,
      zone_name: zone?.name ?? 'Unknown Zone',
      status: bin.status,
      disposal_guidance: DISPOSAL_GUIDANCE[bin.category_code],
    } satisfies PublicBin as T;
  }

  // POST /citizen/disposal-events
  if (upperMethod === 'POST' && path === '/citizen/disposal-events') {
    const actor = resolveActor(headers);
    if (actor.role === 'COLLECTOR') {
      throw new ApiClientError(403, {
        code: 'FORBIDDEN',
        message: 'Collectors cannot record citizen disposal interactions.',
      });
    }
    const idempotencyKey = headers['Idempotency-Key'] || headers['idempotency-key'];
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new ApiClientError(422, {
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key header (8–128 chars) is required.',
      });
    }
    const cacheKey = `${actor.actorId}::${idempotencyKey}`;
    if (state.idempotencyCache[cacheKey]) {
      return clone(state.idempotencyCache[cacheKey]) as T;
    }

    const req = options.body as CreateDisposalEvent;
    const cred = state.qrCredentials.find((c) => c.qr_token === req.qr_token?.trim() && c.active);
    if (!cred) {
      throw new ApiClientError(404, {
        code: 'QR_NOT_FOUND_OR_REVOKED',
        message: 'QR credential is invalid or revoked.',
      });
    }
    const bin = state.bins.find((b) => b.id === cred.bin_id);
    if (!bin) {
      throw new ApiClientError(404, { code: 'BIN_NOT_FOUND', message: 'Bin not found.' });
    }
    if (bin.status !== 'ACTIVE') {
      throw new ApiClientError(422, {
        code: 'BIN_NOT_ACTIVE',
        message: `Bin ${bin.bin_code} is currently ${bin.status} and cannot accept interactions.`,
      });
    }

    const cooldownKey = `${actor.actorId}::${bin.id}`;
    const nextAllowed = state.cooldowns[cooldownKey] ?? 0;
    const now = Date.now();
    if (now < nextAllowed) {
      const retry_after_seconds = Math.max(1, Math.ceil((nextAllowed - now) / 1000));
      throw new ApiClientError(429, {
        code: 'COOLDOWN_ACTIVE',
        message: `Please wait ${retry_after_seconds}s before recording another interaction on ${bin.bin_code}.`,
        retry_after_seconds,
      } satisfies CooldownErrorPayload);
    }

    const event: DisposalEvent = {
      id: uuid(),
      bin_id: bin.id,
      bin_code: bin.bin_code,
      accepted_at: new Date(now).toISOString(),
      event_type: 'DISPOSAL_INTERACTION',
      declared_category_code: req.declared_category_code ?? null,
    };
    state.disposalEvents.unshift({ ...event, actor_id: actor.actorId });
    state.cooldowns[cooldownKey] = now + 300 * 1000;
    state.idempotencyCache[cacheKey] = event;
    saveState(state);
    return clone(event) as T;
  }

  // GET /citizen/disposal-events/me
  if (upperMethod === 'GET' && path === '/citizen/disposal-events/me') {
    const user = requireUser(headers, ['CITIZEN', 'ADMIN']);
    const items = state.disposalEvents
      .filter((e) => e.actor_id === user.id)
      .map(({ actor_id: _actor, ...rest }) => rest);
    return { items } satisfies DisposalEventList as T;
  }

  // GET /collector/tasks
  if (upperMethod === 'GET' && path === '/collector/tasks') {
    const user = requireUser(headers, ['COLLECTOR', 'ADMIN']);
    const statusFilter = query.get('status') as TaskStatus | null;
    const items = state.tasks
      .filter((t) => (user.role === 'ADMIN' ? true : t.assigned_collector_id === user.id || t.assigned_collector_id === null))
      .filter((t) => (statusFilter ? t.status === statusFilter : true))
      .map(({ assigned_collector_id: _c, reason: _r, ...task }) => task);
    return { items } satisfies TaskList as T;
  }

  // POST /collector/bins/{bin_id}/inspections
  const inspectMatch = path.match(/^\/collector\/bins\/([^/]+)\/inspections$/);
  if (upperMethod === 'POST' && inspectMatch) {
    const user = requireUser(headers, ['COLLECTOR', 'ADMIN']);
    const binId = inspectMatch[1];
    const bin = state.bins.find((b) => b.id === binId);
    if (!bin) {
      throw new ApiClientError(404, { code: 'BIN_NOT_FOUND', message: 'Bin not found.' });
    }
    const req = options.body as CreateInspection;
    if (typeof req.fill_percent !== 'number' || req.fill_percent < 0 || req.fill_percent > 100) {
      throw new ApiClientError(422, {
        code: 'VALIDATION_ERROR',
        message: 'fill_percent must be between 0 and 100.',
      });
    }
    const nowIso = new Date().toISOString();
    const inspection: Inspection = {
      id: uuid(),
      bin_id: bin.id,
      collector_id: user.id,
      fill_percent: req.fill_percent,
      overflow: Boolean(req.overflow),
      observed_category_code: req.observed_category_code,
      contamination_level: req.contamination_level,
      estimated_mixed_percent: req.estimated_mixed_percent ?? null,
      inspected_at: nowIso,
      source: req.source,
    };
    state.inspections.unshift(inspection);
    bin.latest_observed_fill_percent = req.fill_percent;
    bin.latest_inspected_at = nowIso;

    if (req.overflow) {
      const hasOpenTask = state.tasks.some(
        (t) => t.bin_id === bin.id && (t.status === 'PENDING' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS'),
      );
      if (!hasOpenTask) {
        state.tasks.unshift({
          id: uuid(),
          bin_id: bin.id,
          bin_code: bin.bin_code,
          priority: 'CRITICAL',
          status: 'ASSIGNED',
          due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          assigned_collector_id: user.id,
          reason: 'Auto-generated urgent collection from overflow inspection',
        });
      } else {
        state.tasks.forEach((t) => {
          if (t.bin_id === bin.id && (t.status === 'PENDING' || t.status === 'ASSIGNED')) {
            t.priority = 'CRITICAL';
          }
        });
      }
    }
    saveState(state);
    return clone(inspection) as T;
  }

  // POST /collector/tasks/{task_id}/complete
  const completeMatch = path.match(/^\/collector\/tasks\/([^/]+)\/complete$/);
  if (upperMethod === 'POST' && completeMatch) {
    const user = requireUser(headers, ['COLLECTOR', 'ADMIN']);
    const taskId = completeMatch[1];
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new ApiClientError(404, { code: 'TASK_NOT_FOUND', message: 'Task not found.' });
    }
    if (user.role === 'COLLECTOR' && task.assigned_collector_id && task.assigned_collector_id !== user.id) {
      throw new ApiClientError(403, { code: 'FORBIDDEN', message: 'Task is assigned to another collector.' });
    }
    const req = options.body as CompleteTask;
    task.status = req.outcome;
    const bin = state.bins.find((b) => b.id === task.bin_id);
    if (bin && typeof req.post_collection_fill_percent === 'number') {
      bin.latest_observed_fill_percent = req.post_collection_fill_percent;
      bin.latest_inspected_at = new Date().toISOString();
    }
    // Sync active route stops if present
    state.routes.forEach((r) => {
      if (r.status === 'ACTIVE') {
        r.stops.forEach((s) => {
          if (s.bin_id === task.bin_id && s.status === 'PENDING') {
            s.status = req.outcome === 'COMPLETED' ? 'COMPLETED' : req.outcome === 'FAILED' ? 'SKIPPED' : 'COMPLETED';
          }
        });
      }
    });
    saveState(state);
    const { assigned_collector_id: _c, reason: _r, ...publicTask } = task;
    return clone(publicTask) as T;
  }

  // POST /collector/incidents
  if (upperMethod === 'POST' && path === '/collector/incidents') {
    requireUser(headers, ['COLLECTOR', 'ADMIN']);
    const req = options.body as CreateIncident;
    const incident: InternalIncidentRecord = {
      id: uuid(),
      type: req.type,
      bin_id: req.bin_id ?? null,
      road_edge_id: req.road_edge_id ?? null,
      severity: req.severity,
      description: req.description,
      status: 'OPEN',
      reported_at: new Date().toISOString(),
    };
    state.incidents.unshift(incident);
    saveState(state);
    return {
      id: incident.id,
      type: incident.type,
      status: incident.status,
      reported_at: incident.reported_at,
    } satisfies Incident as T;
  }

  // GET /admin/zones
  if (upperMethod === 'GET' && path === '/admin/zones') {
    requireUser(headers, ['ADMIN']);
    return { items: clone(state.zones) } satisfies ZoneList as T;
  }

  // POST /admin/zones
  if (upperMethod === 'POST' && path === '/admin/zones') {
    requireUser(headers, ['ADMIN']);
    const req = options.body as CreateZone;
    const zone: Zone = {
      id: uuid(),
      name: req.name.trim(),
      description: req.description?.trim(),
      status: 'ACTIVE',
      center: req.center ?? { latitude: 37.779, longitude: -122.412 },
    };
    state.zones.push(zone);
    saveState(state);
    return clone(zone) as T;
  }

  // PATCH /admin/zones/{zone_id}
  const zoneMatch = path.match(/^\/admin\/zones\/([^/]+)$/);
  if (upperMethod === 'PATCH' && zoneMatch) {
    requireUser(headers, ['ADMIN']);
    const zone = state.zones.find((z) => z.id === zoneMatch[1]);
    if (!zone) {
      throw new ApiClientError(404, { code: 'ZONE_NOT_FOUND', message: 'Zone not found.' });
    }
    const req = options.body as UpdateZone;
    if (req.name !== undefined) zone.name = req.name;
    if (req.description !== undefined) zone.description = req.description;
    if (req.status !== undefined) zone.status = req.status;
    saveState(state);
    return clone(zone) as T;
  }

  // GET /admin/bins
  if (upperMethod === 'GET' && path === '/admin/bins') {
    requireUser(headers, ['ADMIN']);
    const zoneId = query.get('zone_id');
    const categoryCode = query.get('category_code') as CategoryCode | null;
    const status = query.get('status') as BinStatus | null;
    const items = state.bins.filter((b) => {
      if (zoneId && b.zone_id !== zoneId) return false;
      if (categoryCode && b.category_code !== categoryCode) return false;
      if (status && b.status !== status) return false;
      return true;
    });
    return { items: clone(items) } satisfies BinList as T;
  }

  // POST /admin/bins
  if (upperMethod === 'POST' && path === '/admin/bins') {
    requireUser(headers, ['ADMIN']);
    const req = options.body as CreateBin;
    if (state.bins.some((b) => b.bin_code.toLowerCase() === req.bin_code.trim().toLowerCase())) {
      throw new ApiClientError(422, { code: 'DUPLICATE_BIN_CODE', message: `Bin code ${req.bin_code} already exists.` });
    }
    const bin: Bin = {
      id: uuid(),
      bin_code: req.bin_code.trim().toUpperCase(),
      zone_id: req.zone_id,
      category_code: req.category_code,
      capacity_litres: req.capacity_litres,
      location: req.location,
      status: 'ACTIVE',
      latest_observed_fill_percent: null,
      latest_inspected_at: null,
    };
    const qr = generateQrToken(bin.bin_code);
    state.bins.push(bin);
    state.qrCredentials.push({
      bin_id: bin.id,
      qr_token: qr.qr_token,
      qr_payload: qr.qr_payload,
      active: true,
      issued_at: new Date().toISOString(),
    });
    saveState(state);
    return {
      bin: clone(bin),
      qr_token: qr.qr_token,
      qr_payload: qr.qr_payload,
    } satisfies BinCreated as T;
  }

  // GET /admin/bins/{bin_id} & PATCH /admin/bins/{bin_id}
  const binMatch = path.match(/^\/admin\/bins\/([^/]+)$/);
  if (binMatch) {
    requireUser(headers, ['ADMIN']);
    const bin = state.bins.find((b) => b.id === binMatch[1]);
    if (!bin) {
      throw new ApiClientError(404, { code: 'BIN_NOT_FOUND', message: 'Bin not found.' });
    }
    if (upperMethod === 'GET') {
      return clone(bin) as T;
    }
    if (upperMethod === 'PATCH') {
      const req = options.body as UpdateBin;
      if (req.zone_id !== undefined) bin.zone_id = req.zone_id;
      if (req.category_code !== undefined) bin.category_code = req.category_code;
      if (req.capacity_litres !== undefined) bin.capacity_litres = req.capacity_litres;
      if (req.location !== undefined) bin.location = req.location;
      if (req.status !== undefined) bin.status = req.status;
      saveState(state);
      return clone(bin) as T;
    }
  }

  // POST /admin/bins/{bin_id}/qr/rotate
  const rotateMatch = path.match(/^\/admin\/bins\/([^/]+)\/qr\/rotate$/);
  if (upperMethod === 'POST' && rotateMatch) {
    requireUser(headers, ['ADMIN']);
    const bin = state.bins.find((b) => b.id === rotateMatch[1]);
    if (!bin) {
      throw new ApiClientError(404, { code: 'BIN_NOT_FOUND', message: 'Bin not found.' });
    }
    const nowIso = new Date().toISOString();
    state.qrCredentials.forEach((c) => {
      if (c.bin_id === bin.id && c.active) {
        c.active = false;
        c.revoked_at = nowIso;
      }
    });
    const qr = generateQrToken(bin.bin_code);
    state.qrCredentials.push({
      bin_id: bin.id,
      qr_token: qr.qr_token,
      qr_payload: qr.qr_payload,
      active: true,
      issued_at: nowIso,
    });
    saveState(state);
    return {
      bin_id: bin.id,
      qr_token: qr.qr_token,
      qr_payload: qr.qr_payload,
      rotated_at: nowIso,
    } satisfies QrRotation as T;
  }

  // GET /admin/collectors
  if (upperMethod === 'GET' && path === '/admin/collectors') {
    requireUser(headers, ['ADMIN']);
    return { items: clone(state.collectors) } satisfies CollectorList as T;
  }

  // POST /admin/collectors
  if (upperMethod === 'POST' && path === '/admin/collectors') {
    requireUser(headers, ['ADMIN']);
    const req = options.body as CreateCollector;
    const collector: Collector = {
      id: uuid(),
      display_name: req.display_name.trim(),
      email: req.email.trim(),
      status: 'ACTIVE',
      zone_ids: req.zone_ids ?? [],
    };
    state.collectors.push(collector);
    saveState(state);
    return clone(collector) as T;
  }

  // PATCH /admin/collectors/{collector_id}
  const collectorMatch = path.match(/^\/admin\/collectors\/([^/]+)$/);
  if (upperMethod === 'PATCH' && collectorMatch) {
    requireUser(headers, ['ADMIN']);
    const collector = state.collectors.find((c) => c.id === collectorMatch[1]);
    if (!collector) {
      throw new ApiClientError(404, { code: 'COLLECTOR_NOT_FOUND', message: 'Collector not found.' });
    }
    const req = options.body as UpdateCollector;
    if (req.status !== undefined) collector.status = req.status;
    if (req.zone_ids !== undefined) collector.zone_ids = req.zone_ids;
    saveState(state);
    return clone(collector) as T;
  }

  // POST /admin/collection-tasks
  if (upperMethod === 'POST' && path === '/admin/collection-tasks') {
    requireUser(headers, ['ADMIN']);
    const req = options.body as CreateTask;
    const bin = state.bins.find((b) => b.id === req.bin_id);
    if (!bin) {
      throw new ApiClientError(404, { code: 'BIN_NOT_FOUND', message: 'Bin not found.' });
    }
    const task: InternalTaskRecord = {
      id: uuid(),
      bin_id: bin.id,
      bin_code: bin.bin_code,
      priority: req.priority,
      status: req.assigned_collector_id ? 'ASSIGNED' : 'PENDING',
      due_at: req.due_at ?? null,
      assigned_collector_id: req.assigned_collector_id ?? null,
      reason: req.reason,
    };
    state.tasks.unshift(task);
    saveState(state);
    const { assigned_collector_id: _c, reason: _r, ...publicTask } = task;
    return clone(publicTask) as T;
  }

  // GET /admin/analytics/monthly?period=YYYY-MM
  if (upperMethod === 'GET' && path === '/admin/analytics/monthly') {
    requireUser(headers, ['ADMIN']);
    const period = query.get('period') ?? '';
    const existing = state.monthlyAnalytics[period];
    if (!existing) {
      throw new ApiClientError(404, {
        code: 'ANALYTICS_NOT_FOUND',
        message: `No monthly snapshot generated yet for ${period}. Run monthly generation first.`,
      });
    }
    return clone(existing) as T;
  }

  // POST /admin/analytics/monthly/generate
  if (upperMethod === 'POST' && path === '/admin/analytics/monthly/generate') {
    requireUser(headers, ['ADMIN']);
    const req = options.body as GenerateMonthly;
    const period = req.period;
    const includeSimulated = Boolean(req.include_simulated);
    const relevantInspections = state.inspections.filter((i) =>
      i.inspected_at.startsWith(period + '-') && (includeSimulated || i.source === 'REAL'),
    );
    const interactionCount = state.disposalEvents.filter(event => event.accepted_at.startsWith(period + '-')).length;
    const sampleCount = relevantInspections.length;
    const avgFill =
      sampleCount > 0
        ? Number((relevantInspections.reduce((acc, i) => acc + i.fill_percent, 0) / sampleCount).toFixed(1))
        : 0;
    const maxFill = sampleCount > 0 ? Math.max(...relevantInspections.map((i) => i.fill_percent)) : 0;
    const overflowCount = relevantInspections.filter((i) => i.overflow).length;
    const highContamCount = relevantInspections.filter(
      (i) => i.contamination_level === 'MEDIUM' || i.contamination_level === 'HIGH',
    ).length;
    const highContamRate = sampleCount > 0 ? Number(((highContamCount / sampleCount) * 100).toFixed(1)) : 0;
    const inspectedBinIds = new Set(relevantInspections.map((i) => i.bin_id));
    const coveragePct = state.bins.length > 0 ? Number(((inspectedBinIds.size / state.bins.length) * 100).toFixed(1)) : 0;

    const zone_summaries = state.zones.map((z) => {
      const zoneBins = state.bins.filter((b) => b.zone_id === z.id);
      const zoneBinIds = new Set(zoneBins.map((b) => b.id));
      const zoneInspections = relevantInspections.filter((i) => zoneBinIds.has(i.bin_id));
      const zAvgFill =
        zoneInspections.length > 0
          ? Number((zoneInspections.reduce((s, i) => s + i.fill_percent, 0) / zoneInspections.length).toFixed(1))
          : null;
      const zOverflows = zoneInspections.filter((i) => i.overflow).length;
      const zCoverage =
        zoneBins.length > 0
          ? Number(((new Set(zoneInspections.map((i) => i.bin_id)).size / zoneBins.length) * 100).toFixed(1))
          : 0;
      const fillPressure = zAvgFill ?? 0;
      const overflowBurden = Math.min(100, zOverflows * 30);
      const collectionPressure = Math.min(
        100,
        state.tasks.filter((t) => zoneBinIds.has(t.bin_id) && t.status !== 'COMPLETED').length * 25,
      );
      // Reweighted 40/30/20 heuristic over available 90% components (no complaint dataset)
      const hotspot_score = Number(
        ((0.4 / 0.9) * fillPressure + (0.3 / 0.9) * overflowBurden + (0.2 / 0.9) * collectionPressure).toFixed(1),
      );
      return {
        zone_id: z.id,
        zone_name: z.name,
        hotspot_score,
        data_coverage_percent: zCoverage,
        observed_avg_fill_percent: zAvgFill,
        overflow_count: zOverflows,
      };
    });

    const snapshot: MonthlyAnalytics = {
      period,
      generated_at: new Date().toISOString(),
      metrics: [
        {
          name: includeSimulated ? 'Observed Avg Fill (Real + Simulated)' : 'Observed Avg Fill (Real Only)',
          value: avgFill,
          unit: '%',
          sample_count: sampleCount,
          coverage_percent: coveragePct,
        },
        {
          name: 'Observed Max Fill',
          value: maxFill,
          unit: '%',
          sample_count: sampleCount,
          coverage_percent: coveragePct,
        },
        {
          name: 'Overflow Observations',
          value: overflowCount,
          unit: 'events',
          sample_count: sampleCount,
          coverage_percent: coveragePct,
        },
        {
          name: 'Medium/High Contamination Frequency',
          value: highContamRate,
          unit: '% of inspections',
          sample_count: sampleCount,
          coverage_percent: coveragePct,
        },
        {
          name: 'Citizen QR Interactions (Participation)',
          value: interactionCount,
          unit: 'interactions',
          sample_count: interactionCount,
          coverage_percent: 100,
        },
      ],
      zone_summaries: zone_summaries.sort((a, b) => b.hotspot_score - a.hotspot_score),
    };
    state.monthlyAnalytics[period] = snapshot;

    // Ensure recommendations exist for this period if none yet
    if (!state.recommendations.some((r) => r.period === period)) {
      const topZone = snapshot.zone_summaries[0];
      if (topZone && topZone.observed_avg_fill_percent != null) {
        state.recommendations.push({
          id: uuid(),
          period,
          zone_id: topZone.zone_id,
          bin_id: null,
          action_type: topZone.overflow_count && topZone.overflow_count > 0 ? 'INCREASE_COLLECTION_FREQUENCY' : 'INCREASE_INSPECTION_FREQUENCY',
          rationale: `${topZone.zone_name} scored ${topZone.hotspot_score}/100 hotspot pressure across ${topZone.data_coverage_percent}% bin inspection coverage.`,
          evidence_summary: `Observed avg fill: ${topZone.observed_avg_fill_percent ?? 'N/A'}%, overflows: ${topZone.overflow_count ?? 0}.`,
          confidence: topZone.data_coverage_percent >= 70 ? 'HIGH' : 'LOW',
          status: 'PENDING',
        });
      }
    }
    saveState(state);
    return clone(snapshot) as T;
  }

  // GET /admin/recommendations?period=YYYY-MM
  if (upperMethod === 'GET' && path === '/admin/recommendations') {
    requireUser(headers, ['ADMIN']);
    const period = query.get('period') ?? '';
    const items = state.recommendations.filter((r) => r.period === period);
    return { items: clone(items) } satisfies RecommendationList as T;
  }

  // PATCH /admin/recommendations/{recommendation_id}/decision
  const recDecisionMatch = path.match(/^\/admin\/recommendations\/([^/]+)\/decision$/);
  if (upperMethod === 'PATCH' && recDecisionMatch) {
    requireUser(headers, ['ADMIN']);
    const rec = state.recommendations.find((r) => r.id === recDecisionMatch[1]);
    if (!rec) {
      throw new ApiClientError(404, { code: 'RECOMMENDATION_NOT_FOUND', message: 'Recommendation not found.' });
    }
    const req = options.body as RecommendationDecision;
    rec.status =
      req.decision === 'APPROVE'
        ? 'APPROVED'
        : req.decision === 'REJECT'
          ? 'REJECTED'
          : 'EDITED';
    if (req.admin_notes || req.edited_quantity) {
      const suffix = [
        req.edited_quantity ? `Edited quantity: ${req.edited_quantity}` : null,
        req.admin_notes ? `Admin note: ${req.admin_notes}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      rec.evidence_summary = rec.evidence_summary ? `${rec.evidence_summary} (${suffix})` : suffix;
    }
    saveState(state);
    return clone(rec) as T;
  }

  // POST /admin/incidents
  if (upperMethod === 'POST' && path === '/admin/incidents') {
    requireUser(headers, ['ADMIN']);
    const req = options.body as CreateIncident;
    const incident: InternalIncidentRecord = {
      id: uuid(),
      type: req.type,
      bin_id: req.bin_id ?? null,
      road_edge_id: req.road_edge_id ?? null,
      severity: req.severity,
      description: req.description,
      status: 'OPEN',
      reported_at: new Date().toISOString(),
    };
    state.incidents.unshift(incident);
    saveState(state);
    return {
      id: incident.id,
      type: incident.type,
      status: incident.status,
      reported_at: incident.reported_at,
    } satisfies Incident as T;
  }

  // POST /admin/routes/optimize
  if (upperMethod === 'POST' && path === '/admin/routes/optimize') {
    requireUser(headers, ['ADMIN']);
    const req = options.body as OptimizeRoute;
    if (!req.task_ids || req.task_ids.length === 0) {
      throw new ApiClientError(422, { code: 'VALIDATION_ERROR', message: 'Select at least one task to optimize.' });
    }
    const selectedTasks = state.tasks.filter((t) => req.task_ids.includes(t.id));
    if (selectedTasks.length === 0) {
      throw new ApiClientError(404, { code: 'TASKS_NOT_FOUND', message: 'No matching tasks found.' });
    }

    // Nearest-neighbor ordering from depot with priority tie-breaker
    const remainingBins = selectedTasks
      .map((t) => state.bins.find((b) => b.id === t.bin_id))
      .filter((b): b is Bin => Boolean(b));

    const ordered: Bin[] = [];
    let current = req.depot;
    let totalKm = 0;
    const pool = [...remainingBins];
    while (pool.length > 0) {
      pool.sort((a, b) => haversineKm(current, a.location) - haversineKm(current, b.location));
      const next = pool.shift()!;
      totalKm += haversineKm(current, next.location) * 1.35; // urban road factor
      ordered.push(next);
      current = next.location;
    }

    const allDecommissioned = ordered.every((b) => b.status === 'DECOMMISSIONED');
    const route: Route = {
      id: uuid(),
      version: 1,
      status: allDecommissioned ? 'FAILED' : 'ACTIVE',
      distance_estimate_km: allDecommissioned ? null : Number(Math.max(0.8, totalKm).toFixed(2)),
      duration_estimate_minutes: allDecommissioned ? null : Math.max(8, Math.round(totalKm * 4.5 + ordered.length * 3)),
      estimates_source: allDecommissioned ? 'UNAVAILABLE' : 'SIMULATED',
      affected_bin_ids: [],
      stops: ordered.map((bin, idx) => ({
        sequence: idx + 1,
        bin_id: bin.id,
        bin_code: bin.bin_code,
        status: bin.status === 'DECOMMISSIONED' ? 'UNREACHABLE' : 'PENDING',
      })),
    };
    state.routes.unshift(route);
    saveState(state);
    return clone(route) as T;
  }

  // POST /admin/routes/{route_id}/replan
  const replanMatch = path.match(/^\/admin\/routes\/([^/]+)\/replan$/);
  if (upperMethod === 'POST' && replanMatch) {
    requireUser(headers, ['ADMIN']);
    const existingRoute = state.routes.find((r) => r.id === replanMatch[1]);
    if (!existingRoute) {
      throw new ApiClientError(404, { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' });
    }
    const req = options.body as ReplanRoute;
    const incident = state.incidents.find((i) => i.id === req.incident_id);
    if (!incident) {
      throw new ApiClientError(404, { code: 'INCIDENT_NOT_FOUND', message: 'Incident not found.' });
    }

    // Round 3 rules:
    // 1. Preserve COMPLETED stops at their exact sequence
    // 2. Mark BLOCKED_ACCESS bin stop as UNREACHABLE (or road blockage reroute penalty)
    // 3. Raise priority for OVERFLOW incident bins to front of remaining PENDING stops
    // 4. Save a new route version; preserve old version
    const completedStops = existingRoute.stops.filter((s) => s.status === 'COMPLETED');
    const remainingStops = existingRoute.stops.filter((s) => s.status !== 'COMPLETED');

    const affectedSet = new Set<string>();
    const updatedRemaining = remainingStops.map((s) => ({ ...s }));

    if (incident.bin_id) {
      affectedSet.add(incident.bin_id);
    }

    if (incident.type === 'BLOCKED_ACCESS' && incident.bin_id) {
      updatedRemaining.forEach((s) => {
        if (s.bin_id === incident.bin_id) {
          s.status = 'UNREACHABLE';
        }
      });
    } else if (incident.type === 'OVERFLOW' && incident.bin_id) {
      // If overflow bin isn't in remaining stops yet, add it; otherwise move it first among pending
      const existingIdx = updatedRemaining.findIndex((s) => s.bin_id === incident.bin_id);
      if (existingIdx > 0) {
        const [target] = updatedRemaining.splice(existingIdx, 1);
        updatedRemaining.unshift(target);
      } else if (existingIdx === -1) {
        const overflowBin = state.bins.find((b) => b.id === incident.bin_id);
        if (overflowBin) {
          updatedRemaining.unshift({
            sequence: 1,
            bin_id: overflowBin.id,
            bin_code: overflowBin.bin_code,
            status: 'PENDING',
          });
        }
      }
    } else if (incident.type === 'BLOCKED_ROAD') {
      // Simulate road-edge detour: move affected bin later in sequence so truck approaches from south corridor
      if (incident.bin_id) {
        const idx = updatedRemaining.findIndex((s) => s.bin_id === incident.bin_id);
        if (idx !== -1 && updatedRemaining.length > 1) {
          const [detoured] = updatedRemaining.splice(idx, 1);
          updatedRemaining.push(detoured);
        }
      }
    }

    // Detect all bins whose sequence changed
    const newStops = [...completedStops, ...updatedRemaining].map((stop, idx) => {
      const seq = idx + 1;
      const oldStop = existingRoute.stops.find((o) => o.bin_id === stop.bin_id);
      if (!oldStop || oldStop.sequence !== seq || oldStop.status !== stop.status) {
        affectedSet.add(stop.bin_id);
      }
      return { ...stop, sequence: seq };
    });

    const newVersion = existingRoute.version + 1;
    const isBlockedFallback = incident.type === 'OTHER' && incident.severity === 'CRITICAL';
    const replannedRoute: Route = {
      id: uuid(),
      version: newVersion,
      status: isBlockedFallback ? 'FAILED' : 'ACTIVE',
      distance_estimate_km: isBlockedFallback
        ? null
        : Number(((existingRoute.distance_estimate_km ?? 4.5) + (incident.type === 'BLOCKED_ROAD' ? 1.4 : 0.6)).toFixed(2)),
      duration_estimate_minutes: isBlockedFallback
        ? null
        : (existingRoute.duration_estimate_minutes ?? 20) + (incident.type === 'BLOCKED_ROAD' ? 7 : 3),
      estimates_source: isBlockedFallback ? 'UNAVAILABLE' : 'SIMULATED',
      affected_bin_ids: Array.from(affectedSet),
      stops: newStops,
    };
    state.routes.unshift(replannedRoute);
    saveState(state);
    return clone(replannedRoute) as T;
  }

  // GET /admin/routes/{route_id}
  const routeGetMatch = path.match(/^\/admin\/routes\/([^/]+)$/);
  if (upperMethod === 'GET' && routeGetMatch) {
    requireUser(headers, ['ADMIN']);
    const route = state.routes.find((r) => r.id === routeGetMatch[1]);
    if (!route) {
      throw new ApiClientError(404, { code: 'ROUTE_NOT_FOUND', message: 'Route not found.' });
    }
    return clone(route) as T;
  }

  throw new ApiClientError(404, {
    code: 'ENDPOINT_NOT_FOUND',
    message: `No OpenAPI operation matches ${upperMethod} ${path}.`,
  });
}
