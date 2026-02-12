const getApiBaseUrl = (): string =>
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

const getOrCreateExternalId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `guest_${Math.random().toString(36).slice(2, 10)}`;
};

export const getExternalId = (): string => {
  if (typeof window === 'undefined') return 'preview_external_id';
  const STORAGE_KEY = 'haiguitang_external_id';
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const created = getOrCreateExternalId();
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
};

export const fetchWithAuth = async (
  path: string,
  options: RequestInit = {},
): Promise<Response> => {
  const baseUrl = getApiBaseUrl();
  const externalId = getExternalId();
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-External-Id', externalId);
  return fetch(url, { ...options, headers });
};
