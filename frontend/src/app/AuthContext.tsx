import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getStoredAccessToken,
  getStoredAnonymousSession,
  setStoredAccessToken,
  setStoredAnonymousSession,
} from '../services/apiClient';
import { authService } from '../services/authService';
import type { AnonymousSession, LoginRequest, Role, UserSummary } from '../types/api';

interface AuthContextValue {
  user: UserSummary | null;
  anonymousSession: AnonymousSession | null;
  isLoadingAuth: boolean;
  login: (credentials: LoginRequest) => Promise<UserSummary>;
  logout: () => void;
  ensureAnonymousSession: () => Promise<AnonymousSession>;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [anonymousSession, setAnonymousSession] = useState<AnonymousSession | null>(() =>
    getStoredAnonymousSession(),
  );
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  const hydrateSession = useCallback(async () => {
    setIsLoadingAuth(true);
    const token = getStoredAccessToken();
    if (!token) {
      setUser(null);
      setIsLoadingAuth(false);
      return;
    }
    try {
      const res = await authService.getMe();
      setUser(res.user);
    } catch {
      setStoredAccessToken(null);
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const login = useCallback(async (credentials: LoginRequest): Promise<UserSummary> => {
    const res = await authService.login(credentials);
    setStoredAccessToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setStoredAccessToken(null);
    setUser(null);
  }, []);

  const ensureAnonymousSession = useCallback(async (): Promise<AnonymousSession> => {
    const existing = getStoredAnonymousSession();
    if (existing) {
      setAnonymousSession(existing);
      return existing;
    }
    const created = await authService.createAnonymousSession();
    setStoredAnonymousSession(created);
    setAnonymousSession(created);
    return created;
  }, []);

  const hasRole = useCallback(
    (roles: Role[]) => {
      return Boolean(user && roles.includes(user.role));
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        anonymousSession,
        isLoadingAuth,
        login,
        logout,
        ensureAnonymousSession,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
