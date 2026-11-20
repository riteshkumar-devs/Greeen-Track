import type { OptimizeRoute, ReplanRoute, Route } from '../types/api';
import { apiRequest } from './apiClient';

export const routingService = {
  optimizeRoute(payload: OptimizeRoute): Promise<Route> {
    return apiRequest<Route>('/admin/routes/optimize', {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },

  replanRoute(routeId: string, payload: ReplanRoute): Promise<Route> {
    return apiRequest<Route>(`/admin/routes/${encodeURIComponent(routeId)}/replan`, {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },

  getRoute(routeId: string): Promise<Route> {
    return apiRequest<Route>(`/admin/routes/${encodeURIComponent(routeId)}`, {
      method: 'GET',
      auth: 'bearer',
    });
  },
};
