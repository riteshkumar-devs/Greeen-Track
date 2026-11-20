import type { AnonymousSession, AuthResponse, Health, LoginRequest, Me } from '../types/api';
import { apiRequest } from './apiClient';

export const authService = {
  getHealth(): Promise<Health> {
    return apiRequest<Health>('/health', { method: 'GET', auth: 'none' });
  },

  createAnonymousSession(): Promise<AnonymousSession> {
    return apiRequest<AnonymousSession>('/auth/anonymous-sessions', {
      method: 'POST',
      auth: 'none',
    });
  },

  login(payload: LoginRequest): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      auth: 'none',
    });
  },

  getMe(): Promise<Me> {
    return apiRequest<Me>('/me', { method: 'GET', auth: 'bearer' });
  },
};
