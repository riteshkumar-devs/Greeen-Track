import type {
  GenerateMonthly,
  MonthlyAnalytics,
  Recommendation,
  RecommendationDecision,
  RecommendationList,
} from '../types/api';
import { apiRequest } from './apiClient';

export const analyticsService = {
  getMonthlyAnalytics(period: string): Promise<MonthlyAnalytics> {
    return apiRequest<MonthlyAnalytics>(`/admin/analytics/monthly?period=${encodeURIComponent(period)}`, {
      method: 'GET',
      auth: 'bearer',
    });
  },

  generateMonthlyAnalytics(payload: GenerateMonthly): Promise<MonthlyAnalytics> {
    return apiRequest<MonthlyAnalytics>('/admin/analytics/monthly/generate', {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },

  listRecommendations(period: string): Promise<RecommendationList> {
    return apiRequest<RecommendationList>(`/admin/recommendations?period=${encodeURIComponent(period)}`, {
      method: 'GET',
      auth: 'bearer',
    });
  },

  decideRecommendation(recommendationId: string, payload: RecommendationDecision): Promise<Recommendation> {
    return apiRequest<Recommendation>(
      `/admin/recommendations/${encodeURIComponent(recommendationId)}/decision`,
      {
        method: 'PATCH',
        body: payload,
        auth: 'bearer',
      },
    );
  },
};
