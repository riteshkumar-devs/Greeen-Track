import { ENV_CONFIG } from '../config/env';
import { ApiClientError, handleMockRequest } from '../mocks/mockApi';
import type { ApiErrorPayload, CooldownErrorPayload } from '../types/api';

const ACCESS_TOKEN_KEY = 'greentrack_access_token';
const ANON_SESSION_KEY = 'greentrack_anon_session';

export function getStoredAccessToken(): string | null {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export function getStoredAnonymousSession(): { session_token: string; expires_at: string } | null {
  try {
    const raw = window.localStorage.getItem(ANON_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { session_token: string; expires_at: string };
    if (new Date(parsed.expires_at).getTime() <= Date.now()) {
      window.localStorage.removeItem(ANON_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredAnonymousSession(session: { session_token: string; expires_at: string } | null): void {
  try {
    if (session) {
      window.localStorage.setItem(ANON_SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(ANON_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: 'none' | 'bearer' | 'citizen';
}

export async function apiRequest<T>(pathWithQuery: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers ?? {}),
  };

  const authMode = options.auth ?? 'bearer';
  if (authMode === 'bearer') {
    const token = getStoredAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (authMode === 'citizen') {
    const token = getStoredAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      const anon = getStoredAnonymousSession();
      if (anon) {
        headers['X-Anonymous-Session'] = anon.session_token;
      }
    }
  }

  if (ENV_CONFIG.defaultUseMockApi) {
    return handleMockRequest<T>(method, pathWithQuery, {
      headers,
      body: options.body,
    });
  }

  const url = `${ENV_CONFIG.apiBaseUrl}${pathWithQuery}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    throw new ApiClientError(0, {
      code: 'NETWORK_ERROR',
      message: `Unable to reach backend at ${ENV_CONFIG.apiBaseUrl}.`,
      details: { cause: err instanceof Error ? err.message : String(err) },
    });
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { code: 'INVALID_JSON', message: text };
    }
  }

  if (!response.ok) {
    const payload = (parsed && typeof parsed === 'object' ? parsed : {
      code: `HTTP_${response.status}`,
      message: response.statusText || 'Request failed',
    }) as ApiErrorPayload | CooldownErrorPayload;
    throw new ApiClientError(response.status, payload);
  }

  return parsed as T;
}

export { ApiClientError };
