export interface EnvConfig {
  apiBaseUrl: string;
  defaultUseMockApi: boolean;
}

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const rawUseMock = (import.meta.env.VITE_USE_MOCK_API as string | undefined)?.trim().toLowerCase();

export const ENV_CONFIG: EnvConfig = {
  apiBaseUrl: rawBaseUrl && rawBaseUrl.length > 0 ? rawBaseUrl.replace(/\/+$/, '') : 'http://localhost:8000/api/v1',
  // Default to mock mode if VITE_USE_MOCK_API is 'true' OR if unset and no explicit VITE_API_BASE_URL was configured
  defaultUseMockApi: rawUseMock === 'true' || (rawUseMock !== 'false' && !rawBaseUrl),
};
