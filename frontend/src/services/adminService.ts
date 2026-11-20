import type {
  Bin,
  BinCreated,
  BinList,
  BinStatus,
  CategoryCode,
  Collector,
  CollectorList,
  CreateBin,
  CreateCollector,
  CreateIncident,
  CreateTask,
  CreateZone,
  Incident,
  QrRotation,
  Task,
  UpdateBin,
  UpdateCollector,
  UpdateZone,
  Zone,
  ZoneList,
} from '../types/api';
import { ENV_CONFIG } from '../config/env';
import { readActiveLocalQr, provisionLocalCollector } from '../mocks/mockApi';
import { apiRequest, getStoredAccessToken } from './apiClient';

export const adminService = {
  provisionCollector(input: CreateCollector, password: string, id?: string) {
    if (!ENV_CONFIG.defaultUseMockApi) throw new Error('Local collector credentials require local mode.');
    return provisionLocalCollector({ Authorization: 'Bearer ' + getStoredAccessToken() }, input, password, id);
  },
  localQr(binId: string) {
    if (!ENV_CONFIG.defaultUseMockApi) return null;
    const token = getStoredAccessToken();
    if (!token) return null;
    return readActiveLocalQr(binId, { Authorization: `Bearer ${token}` });
  },

  listZones(): Promise<ZoneList> {
    return apiRequest<ZoneList>('/admin/zones', { method: 'GET', auth: 'bearer' });
  },

  createZone(payload: CreateZone): Promise<Zone> {
    return apiRequest<Zone>('/admin/zones', { method: 'POST', body: payload, auth: 'bearer' });
  },

  updateZone(zoneId: string, payload: UpdateZone): Promise<Zone> {
    return apiRequest<Zone>(`/admin/zones/${encodeURIComponent(zoneId)}`, {
      method: 'PATCH',
      body: payload,
      auth: 'bearer',
    });
  },

  listBins(filters?: { zone_id?: string; category_code?: CategoryCode; status?: BinStatus }): Promise<BinList> {
    const params = new URLSearchParams();
    if (filters?.zone_id) params.set('zone_id', filters.zone_id);
    if (filters?.category_code) params.set('category_code', filters.category_code);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return apiRequest<BinList>(`/admin/bins${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      auth: 'bearer',
    });
  },

  createBin(payload: CreateBin): Promise<BinCreated> {
    return apiRequest<BinCreated>('/admin/bins', {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },

  getBin(binId: string): Promise<Bin> {
    return apiRequest<Bin>(`/admin/bins/${encodeURIComponent(binId)}`, {
      method: 'GET',
      auth: 'bearer',
    });
  },

  updateBin(binId: string, payload: UpdateBin): Promise<Bin> {
    return apiRequest<Bin>(`/admin/bins/${encodeURIComponent(binId)}`, {
      method: 'PATCH',
      body: payload,
      auth: 'bearer',
    });
  },

  rotateBinQr(binId: string): Promise<QrRotation> {
    return apiRequest<QrRotation>(`/admin/bins/${encodeURIComponent(binId)}/qr/rotate`, {
      method: 'POST',
      auth: 'bearer',
    });
  },

  listCollectors(): Promise<CollectorList> {
    return apiRequest<CollectorList>('/admin/collectors', { method: 'GET', auth: 'bearer' });
  },

  createCollector(payload: CreateCollector): Promise<Collector> {
    return apiRequest<Collector>('/admin/collectors', {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },

  updateCollector(collectorId: string, payload: UpdateCollector): Promise<Collector> {
    return apiRequest<Collector>(`/admin/collectors/${encodeURIComponent(collectorId)}`, {
      method: 'PATCH',
      body: payload,
      auth: 'bearer',
    });
  },

  createCollectionTask(payload: CreateTask): Promise<Task> {
    return apiRequest<Task>('/admin/collection-tasks', {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },

  createIncident(payload: CreateIncident): Promise<Incident> {
    return apiRequest<Incident>('/admin/incidents', {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },
};
