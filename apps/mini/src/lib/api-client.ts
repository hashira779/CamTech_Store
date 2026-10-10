import type { SaleDto, Paginated, ProductDto } from '@mystore/contracts';

export const BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000';
    }
    // Production Gateway
    return 'https://gateway.camtech.cam';
  }
  return 'http://localhost:4000';
})();

export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public status: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, options: {
  method?: string;
  token?: string;
  body?: any;
  headers?: Record<string, string>;
} = {}): Promise<T> {
  const url = `${BASE_URL}/api/v1${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
    });
  } catch (err: any) {
    // If gateway is down or blocked, attempt fallback via admin console reverse proxy
    if (url.includes('gateway.camtech.cam')) {
      const fallbackUrl = url.replace('gateway.camtech.cam', 'adminconsol.camtech.cam');
      res = await fetch(fallbackUrl, {
        method: options.method || 'GET',
        headers,
        body: options.body,
      });
    } else {
      throw err;
    }
  }

  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError('Invalid JSON response', 'PARSE_ERROR', res.status);
  }

  if (!res.ok || body.success === false) {
    const err = body.error || {};
    throw new ApiClientError(
      err.message || body.message || `Request failed with status ${res.status}`,
      err.code || 'API_ERROR',
      res.status,
      err.details
    );
  }

  return (body.data !== undefined ? body.data : body) as T;
}

export const api = {
  getPublicProducts: (params: { limit?: number; page?: number; search?: string; organizationId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.page) qs.set('page', String(params.page));
    if (params.search) qs.set('search', params.search);
    if (params.organizationId) qs.set('organizationId', params.organizationId);
    return request<Paginated<ProductDto>>(`/public/products${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  listProducts: (token: string, params: { limit?: number; page?: number; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.page) qs.set('page', String(params.page));
    if (params.search) qs.set('search', params.search);
    return request<Paginated<ProductDto>>(`/catalog/products${qs.toString() ? `?${qs.toString()}` : ''}`, { token });
  },

  storeCheckout: (token: string | null, payload: any) =>
    request<SaleDto>('/sales/store-checkout', {
      method: 'POST',
      token: token || undefined,
      body: JSON.stringify(payload),
    }),

  getCustomerOrders: (params: { phone?: string; email?: string; organizationId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.phone) qs.set('phone', params.phone);
    if (params.email) qs.set('email', params.email);
    if (params.organizationId) qs.set('organization_id', params.organizationId);
    return request<Paginated<SaleDto>>(`/sales/customer-orders${qs.toString() ? `?${qs.toString()}` : ''}`);
  },

  getOrderPaymentStatus: (saleId: string) =>
    request<{ paid: boolean; status: string; saleId: string; saleNumber: string; amount: number; provider?: string }>(
      `/sales/orders/${saleId}/payment-status`
    ),

  authTelegramMiniApp: (payload: any) =>
    request<{
      token: string;
      organizationId: string;
      botName?: string;
      customer?: any;
    }>('/telegram/mini-app/auth', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  syncTelegramContact: (token: string | null, payload: any) =>
    request<{
      customer: any;
    }>('/telegram/mini-app/sync-contact', {
      method: 'POST',
      token: token || undefined,
      body: JSON.stringify(payload),
    }),
};
