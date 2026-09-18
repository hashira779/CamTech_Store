export const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
})();

export const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const token =
    localStorage.getItem('mystore_pos_token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('token') ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Unwrap the various envelope shapes the platform APIs return. */
export const unwrap = (json: any, key?: string): any[] => {
  if (key && json?.data?.[key]) return json.data[key];
  if (key && json?.[key]) return json[key];
  return json?.data?.items || json?.items || json?.data || [];
};
