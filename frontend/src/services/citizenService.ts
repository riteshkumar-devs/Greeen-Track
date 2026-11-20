import type {
  CreateDisposalEvent,
  DisposalEvent,
  DisposalEventList,
  PublicBin,
  ResolveBinRequest,
} from '../types/api';
import { apiRequest } from './apiClient';

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `gt-evt-${crypto.randomUUID()}`;
  }
  return `gt-evt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export const citizenService = {
  resolveBinQr(payload: ResolveBinRequest): Promise<PublicBin> {
    return apiRequest<PublicBin>('/public/bins/resolve', {
      method: 'POST',
      body: payload,
      auth: 'none',
    });
  },

  createDisposalEvent(payload: CreateDisposalEvent, idempotencyKey: string): Promise<DisposalEvent> {
    return apiRequest<DisposalEvent>('/citizen/disposal-events', {
      method: 'POST',
      body: payload,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      auth: 'citizen',
    });
  },

  getMyDisposalEvents(): Promise<DisposalEventList> {
    return apiRequest<DisposalEventList>('/citizen/disposal-events/me', {
      method: 'GET',
      auth: 'bearer',
    });
  },
};
