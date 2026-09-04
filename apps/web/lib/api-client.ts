import type {
  ApiResponse,
  CreateProductInput,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateSaleInput,
  AdjustInventoryInput,
  LoginResult,
  Paginated,
  ProductDto,
  CustomerDto,
  SaleDto,
  SaleSummaryDto,
  InventoryItemDto,
  StockMovementDto,
  LocationDto,
  LocationTreeNodeDto,
  CreateLocationInput,
  UpdateLocationInput,
  OrganizationDto,
  UpdateOrganizationSettingsInput,
  SupplierDto,
  CreateSupplierInput,
  UpdateSupplierInput,
  PurchaseOrderDto,
  PurchaseOrderSummaryDto,
  CreatePurchaseOrderInput,
  GoodsReceiptDto,
  CreateGoodsReceiptInput,
  PromotionDto,
  CreatePromotionInput,
  UpdatePromotionInput,
  EvaluatePromotionInput,
  PromotionEvaluationResultDto,
  PriceListDto,
  CreatePriceListInput,
  UpdatePriceListInput,
  PriceListItemDto,
  SetPriceListItemInput,
  ResolvePricesInput,
  ResolvedPricesResultDto,
  SyncBatchRequest,
  SyncBatchResponseDto,
  CreatePaymentIntentInput,
  PaymentIntentDto,
  PaymentVerificationDto,
  PaymentWebhookPayload,
  StockTransferDto,
  CreateStockTransferInput,
  UpdateStockTransferStatusInput,
  ReceiveStockTransferInput,
  WarehouseZoneDto,
  WarehouseBinDto,
  ProductBatchDto,
  CreateWarehouseZoneInput,
  CreateWarehouseBinInput,
  CreateProductBatchInput,
  StockTransferStatus,
  TaxRateDto,
  CreateTaxRateInput,
  UpdateTaxRateInput,
  CalculateTaxesInput,
  TaxCalculationResultDto,
  LoyaltyProgramConfigDto,
  LoyaltyTransactionDto,
  StoreCreditTransactionDto,
  CustomerLoyaltyProfileDto,
  UpdateLoyaltyConfigInput,
  AdjustLoyaltyPointsInput,
  AdjustStoreCreditInput,
  RedeemLoyaltyPointsInput,
  UploadIntentDto,
  DocumentRecordDto,
  StorageStatsDto,
  CreateUploadIntentInput,
  ConfirmUploadInput,
  ListDocumentsQuery,
  DocumentEntityType,
  NotificationRecordDto,
  NotificationConfigDto,
  NotificationStatsDto,
  SendNotificationInput,
  UpdateNotificationConfigInput,
  ListNotificationsQuery,
  ExecutiveReportSummaryDto,
  ReportDateRangeQuery,
  ExportReportQuery,
  AccountDto,
  CreateAccountInput,
  UpdateAccountInput,
  JournalEntryDto,
  CreateJournalEntryInput,
  TrialBalanceDto,
  IncomeStatementDto,
  BalanceSheetDto,
  FinanceSummaryDto,
  FinancialStatementQuery,
  JournalEntryStatus,
  AccountType,
  WorkflowInstanceDto,
  SubmitApprovalInput,
  ReviewWorkflowStepInput,
  WorkflowStatus,
  DepartmentDto,
  CreateDepartmentInput,
  EmployeeDto,
  CreateEmployeeInput,
  LeaveRequestDto,
  CreateLeaveRequestInput,
  PayrollRunDto,
  CreatePayrollRunInput,
  FixedAssetDto,
  CreateFixedAssetInput,
  DepreciationRecordDto,
  ProjectDto,
  CreateProjectInput,
  ProjectTaskDto,
  CreateProjectTaskInput,
  TimesheetEntryDto,
  LogTimesheetInput,
  ServiceTicketDto,
  CreateServiceTicketInput,
  TicketCommentDto,
  AddTicketCommentInput,
  TicketStatus,
  TicketPriority,
  DeveloperAppDto,
  CreateDeveloperAppInput,
  ApiKeyDto,
  CreateApiKeyInput,
  CreateApiKeyResultDto,
  WebhookSubscriptionDto,
  CreateWebhookSubscriptionInput,
  TelegramChatBindingDto,
  BindTelegramChatInput,
  AutomationFlowDto,
  CreateFlowInput,
  UpdateFlowInput,
  FlowExecutionDto,
  DeliveryOrderDto,
  DeliveryDriverDto,
  LiveTrackingSnapshotDto,
  CreateDeliveryOrderInput,
  CreateDriverInput,
  CopilotChatResponse,
  IndustryConfigDto,
  TableDto,
  KDSTicketDto,
} from '@mystore/contracts';



const resolveApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  return (
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
    (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_API_URL) ||
    'http://localhost:4000'
  );
};

export const BASE_URL = resolveApiBaseUrl();
export const API = `${BASE_URL}/api/v1`;

/** Error carrying the backend's stable code + requestId (spec §14). */
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError('NETWORK', `Unexpected response (HTTP ${res.status})`);
  }

  if (!body.success) {
    throw new ApiClientError(body.code, body.message, body.requestId);
  }
  return body.data;
}

export const api = {
  // ─── Auth ──────────────────────────────────────────────────────
  login: (email: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  oauthSync: (data: { email: string; name?: string; provider?: string; providerId?: string; avatarUrl?: string }) =>
    request<LoginResult>('/auth/oauth-sync', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ─── Products ──────────────────────────────────────────────────
  listProducts: (token: string, params: { page?: number; limit?: number; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<Paginated<ProductDto>>(`/products${q ? `?${q}` : ''}`, { token });
  },

  createProduct: (token: string, input: CreateProductInput) =>
    request<ProductDto>('/products', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Customers ─────────────────────────────────────────────────
  listCustomers: (token: string, params: { page?: number; limit?: number; search?: string; type?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.type) qs.set('type', params.type);
    const q = qs.toString();
    return request<Paginated<CustomerDto>>(`/customers${q ? `?${q}` : ''}`, { token });
  },

  createCustomer: (token: string, input: CreateCustomerInput) =>
    request<CustomerDto>('/customers', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updateCustomer: (token: string, id: string, input: UpdateCustomerInput) =>
    request<CustomerDto>(`/customers/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Sales ─────────────────────────────────────────────────────
  listSales: (
    token: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      channel?: string;
      search?: string;
      from?: string;
      to?: string;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status) qs.set('status', params.status);
    if (params.channel) qs.set('channel', params.channel);
    if (params.search) qs.set('search', params.search);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const q = qs.toString();
    return request<Paginated<SaleSummaryDto>>(`/sales${q ? `?${q}` : ''}`, { token });
  },

  getSale: (token: string, id: string) =>
    request<SaleDto>(`/sales/${id}`, { token }),

  createSale: (token: string, input: CreateSaleInput) => {
    // The canonical Python backend expects `items: [{ variantId, quantity }]`,
    // while the shared contract still uses `lineItems: [{ productVariantId }]`.
    // Adapt at the boundary so POS checkout works until the contract is
    // reconciled with the backend. Price/tax are resolved server-side.
    const body = {
      ...input,
      items: (input.lineItems ?? []).map((li) => ({
        variantId: li.productVariantId,
        quantity: li.quantity,
      })),
    };
    return request<SaleDto>('/sales', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    });
  },

  syncSalesBatch: (token: string, input: SyncBatchRequest) =>
    request<SyncBatchResponseDto>('/sales/sync-batch', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  voidSale: (token: string, id: string) =>
    request<SaleDto>(`/sales/${id}/void`, { method: 'POST', token }),

  // ─── Inventory ─────────────────────────────────────────────────
  listInventory: (
    token: string,
    params: {
      page?: number;
      limit?: number;
      locationId?: string;
      lowStockOnly?: boolean;
      search?: string;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.locationId) qs.set('locationId', params.locationId);
    if (params.lowStockOnly) qs.set('lowStockOnly', 'true');
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<Paginated<InventoryItemDto>>(`/inventory${q ? `?${q}` : ''}`, { token });
  },

  adjustInventory: (token: string, input: AdjustInventoryInput) =>
    request<InventoryItemDto>('/inventory/adjust', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  getMovements: (token: string, variantId: string) =>
    request<{ items: StockMovementDto[]; total: number }>(`/inventory/${variantId}/movements`, {
      token,
    }),

  // ─── Locations ─────────────────────────────────────────────────
  listLocations: (
    token: string,
    params: { page?: number; limit?: number; search?: string; type?: string; parentId?: string | null } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.type) qs.set('type', params.type);
    if (params.parentId !== undefined) qs.set('parentId', params.parentId ?? '');
    const q = qs.toString();
    return request<Paginated<LocationDto>>(`/locations${q ? `?${q}` : ''}`, { token });
  },

  getLocationTree: (token: string) =>
    request<LocationTreeNodeDto[]>('/locations/tree', { token }),

  createLocation: (token: string, input: CreateLocationInput) =>
    request<LocationDto>('/locations', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updateLocation: (token: string, id: string, input: UpdateLocationInput) =>
    request<LocationDto>(`/locations/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  deleteLocation: (token: string, id: string) =>
    request<{ success: boolean }>(`/locations/${id}`, {
      method: 'DELETE',
      token,
    }),

  // ─── Organizations ─────────────────────────────────────────────
  getCurrentOrg: (token: string) =>
    request<OrganizationDto>('/organizations/current', { token }),

  updateOrgSettings: (token: string, input: UpdateOrganizationSettingsInput) =>
    request<OrganizationDto>('/organizations/current/settings', {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Procurement & Suppliers ───────────────────────────────────
  listSuppliers: (token: string, params: { page?: number; limit?: number; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<Paginated<SupplierDto>>(`/procurement/suppliers${q ? `?${q}` : ''}`, { token });
  },

  createSupplier: (token: string, input: CreateSupplierInput) =>
    request<SupplierDto>('/procurement/suppliers', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updateSupplier: (token: string, id: string, input: UpdateSupplierInput) =>
    request<SupplierDto>(`/procurement/suppliers/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Purchase Orders ───────────────────────────────────────────
  listPurchaseOrders: (
    token: string,
    params: { page?: number; limit?: number; status?: string; supplierId?: string; locationId?: string; search?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status) qs.set('status', params.status);
    if (params.supplierId) qs.set('supplierId', params.supplierId);
    if (params.locationId) qs.set('locationId', params.locationId);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<Paginated<PurchaseOrderSummaryDto>>(`/procurement/orders${q ? `?${q}` : ''}`, { token });
  },

  getPurchaseOrder: (token: string, id: string) =>
    request<PurchaseOrderDto>(`/procurement/orders/${id}`, { token }),

  createPurchaseOrder: (token: string, input: CreatePurchaseOrderInput) =>
    request<PurchaseOrderDto>('/procurement/orders', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  approvePurchaseOrder: (token: string, id: string) =>
    request<PurchaseOrderDto>(`/procurement/orders/${id}/approve`, {
      method: 'POST',
      token,
    }),

  cancelPurchaseOrder: (token: string, id: string) =>
    request<PurchaseOrderDto>(`/procurement/orders/${id}/cancel`, {
      method: 'POST',
      token,
    }),

  // ─── Goods Receipt Notes (GRN) ─────────────────────────────────
  receiveGoods: (token: string, poId: string, input: CreateGoodsReceiptInput) =>
    request<GoodsReceiptDto>(`/procurement/orders/${poId}/receive`, {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  listGoodsReceipts: (token: string, params: { page?: number; limit?: number; poId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.poId) qs.set('poId', params.poId);
    const q = qs.toString();
    return request<Paginated<GoodsReceiptDto>>(`/procurement/receipts${q ? `?${q}` : ''}`, { token });
  },

  // ─── Promotions & Discounts ────────────────────────────────────
  listPromotions: (
    token: string,
    params: { page?: number; limit?: number; type?: string; scope?: string; isActive?: boolean; search?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.type) qs.set('type', params.type);
    if (params.scope) qs.set('scope', params.scope);
    if (params.isActive !== undefined) qs.set('isActive', String(params.isActive));
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<Paginated<PromotionDto>>(`/promotions${q ? `?${q}` : ''}`, { token });
  },

  createPromotion: (token: string, input: CreatePromotionInput) =>
    request<PromotionDto>('/promotions', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updatePromotion: (token: string, id: string, input: UpdatePromotionInput) =>
    request<PromotionDto>(`/promotions/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  evaluatePromotion: (token: string, input: EvaluatePromotionInput) =>
    request<PromotionEvaluationResultDto>('/promotions/evaluate', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Pricing & Price Lists ─────────────────────────────────────
  listPriceLists: (
    token: string,
    params: { page?: number; limit?: number; customerType?: string; isActive?: boolean; search?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.customerType) qs.set('customerType', params.customerType);
    if (params.isActive !== undefined) qs.set('isActive', String(params.isActive));
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<Paginated<PriceListDto>>(`/pricing/lists${q ? `?${q}` : ''}`, { token });
  },

  getPriceList: (token: string, id: string) =>
    request<PriceListDto>(`/pricing/lists/${id}`, { token }),

  createPriceList: (token: string, input: CreatePriceListInput) =>
    request<PriceListDto>('/pricing/lists', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updatePriceList: (token: string, id: string, input: UpdatePriceListInput) =>
    request<PriceListDto>(`/pricing/lists/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  setPriceListItem: (token: string, priceListId: string, input: SetPriceListItemInput) =>
    request<PriceListItemDto>(`/pricing/lists/${priceListId}/items`, {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  deletePriceListItem: (token: string, priceListId: string, itemId: string) =>
    request<{ success: boolean }>(`/pricing/lists/${priceListId}/items/${itemId}`, {
      method: 'DELETE',
      token,
    }),

  resolvePrices: (token: string, input: ResolvePricesInput) =>
    request<ResolvedPricesResultDto>('/pricing/resolve', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Payments & KHQR ───────────────────────────────────────────
  createPaymentIntent: (token: string, input: CreatePaymentIntentInput) =>
    request<PaymentIntentDto>('/payments/intent', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  verifyPayment: (token: string, id: string) =>
    request<PaymentVerificationDto>(`/payments/${id}/verify`, { token }),

  simulatePaymentWebhook: (provider: string, payload: PaymentWebhookPayload) =>
    request<{ success: boolean; paymentId: string; status: string }>(`/payments/webhook/${provider}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ─── WMS & Stock Transfers ─────────────────────────────────────
  listTransfers: (
    token: string,
    query?: { status?: StockTransferStatus; sourceLocationId?: string; destLocationId?: string },
  ) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.sourceLocationId) params.set('sourceLocationId', query.sourceLocationId);
    if (query?.destLocationId) params.set('destLocationId', query.destLocationId);
    const qs = params.toString();
    return request<StockTransferDto[]>(`/wms/transfers${qs ? `?${qs}` : ''}`, { token });
  },

  getTransfer: (token: string, id: string) =>
    request<StockTransferDto>(`/wms/transfers/${id}`, { token }),

  createTransfer: (token: string, input: CreateStockTransferInput) =>
    request<StockTransferDto>('/wms/transfers', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updateTransferStatus: (token: string, id: string, input: UpdateStockTransferStatusInput) =>
    request<StockTransferDto>(`/wms/transfers/${id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  shipTransfer: (token: string, id: string) =>
    request<StockTransferDto>(`/wms/transfers/${id}/ship`, {
      method: 'POST',
      token,
    }),

  receiveTransfer: (token: string, id: string, input: ReceiveStockTransferInput) =>
    request<StockTransferDto>(`/wms/transfers/${id}/receive`, {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  listZones: (token: string, locationId?: string) => {
    const qs = locationId ? `?locationId=${locationId}` : '';
    return request<WarehouseZoneDto[]>(`/wms/zones${qs}`, { token });
  },

  createZone: (token: string, input: CreateWarehouseZoneInput) =>
    request<WarehouseZoneDto>('/wms/zones', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  createBin: (token: string, input: CreateWarehouseBinInput) =>
    request<WarehouseBinDto>('/wms/bins', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  listBatches: (token: string, variantId?: string) => {
    const qs = variantId ? `?productVariantId=${variantId}` : '';
    return request<ProductBatchDto[]>(`/wms/batches${qs}`, { token });
  },

  createBatch: (token: string, input: CreateProductBatchInput) =>
    request<ProductBatchDto>('/wms/batches', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Taxes & Fiscal Rules ──────────────────────────────────────
  listTaxRates: (token: string) =>
    request<TaxRateDto[]>('/taxes/rates', { token }),

  createTaxRate: (token: string, input: CreateTaxRateInput) =>
    request<TaxRateDto>('/taxes/rates', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updateTaxRate: (token: string, id: string, input: UpdateTaxRateInput) =>
    request<TaxRateDto>(`/taxes/rates/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  deleteTaxRate: (token: string, id: string) =>
    request<{ success: boolean }>(`/taxes/rates/${id}`, {
      method: 'DELETE',
      token,
    }),

  calculateTaxes: (token: string, input: CalculateTaxesInput) =>
    request<TaxCalculationResultDto>('/taxes/calculate', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Loyalty & Store Credit ───────────────────────────────────
  getLoyaltyConfig: (token: string) =>
    request<LoyaltyProgramConfigDto>('/loyalty/config', { token }),

  updateLoyaltyConfig: (token: string, input: UpdateLoyaltyConfigInput) =>
    request<LoyaltyProgramConfigDto>('/loyalty/config', {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  getCustomerLoyaltyProfile: (token: string, customerId: string) =>
    request<CustomerLoyaltyProfileDto>(`/loyalty/customers/${customerId}`, { token }),

  adjustLoyaltyPoints: (token: string, input: AdjustLoyaltyPointsInput) =>
    request<LoyaltyTransactionDto>('/loyalty/points/adjust', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  redeemLoyaltyPoints: (token: string, input: RedeemLoyaltyPointsInput) =>
    request<{ transaction: LoyaltyTransactionDto; discountAmount: number }>('/loyalty/points/redeem', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  adjustStoreCredit: (token: string, input: AdjustStoreCreditInput) =>
    request<StoreCreditTransactionDto>('/loyalty/credit/adjust', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  listLoyaltyTransactions: (token: string, customerId?: string) => {
    const qs = customerId ? `?customerId=${customerId}` : '';
    return request<LoyaltyTransactionDto[]>(`/loyalty/transactions/points${qs}`, { token });
  },

  listStoreCreditTransactions: (token: string, customerId?: string) => {
    const qs = customerId ? `?customerId=${customerId}` : '';
    return request<StoreCreditTransactionDto[]>(`/loyalty/transactions/credit${qs}`, { token });
  },

  // ─── Storage & Documents Platform ─────────────────────────────
  createUploadIntent: (token: string, input: CreateUploadIntentInput) =>
    request<UploadIntentDto>('/storage/upload-intent', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  confirmUpload: (token: string, input: ConfirmUploadInput) =>
    request<DocumentRecordDto>('/storage/confirm-upload', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  listDocuments: (token: string, query?: ListDocumentsQuery) => {
    const params = new URLSearchParams();
    if (query?.entityType) params.append('entityType', query.entityType);
    if (query?.entityId) params.append('entityId', query.entityId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<DocumentRecordDto[]>(`/storage/documents${qs}`, { token });
  },

  deleteDocument: (token: string, id: string) =>
    request<{ success: boolean }>(`/storage/documents/${id}`, {
      method: 'DELETE',
      token,
    }),

  getStorageStats: (token: string) =>
    request<StorageStatsDto>('/storage/stats', { token }),

  uploadFile: async (
    token: string,
    file: File,
    entityType?: DocumentEntityType,
    entityId?: string,
  ): Promise<DocumentRecordDto> => {
    // 1. Get upload intent
    const intent = await api.createUploadIntent(token, {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      byteSize: file.size,
      entityType,
      entityId,
    });

    // 2. Upload file directly to destination URL
    const uploadRes = await fetch(intent.uploadUrl, {
      method: intent.method,
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        ...(intent.headers || {}),
      },
    });

    if (!uploadRes.ok) {
      throw new Error(`Failed to upload file to storage (${uploadRes.status})`);
    }

    // 3. Confirm upload
    return api.confirmUpload(token, { documentId: intent.documentId });
  },

  // ─── Notifications Platform ───────────────────────────────────
  listNotifications: (token: string, query?: ListNotificationsQuery) => {
    const params = new URLSearchParams();
    if (query?.channel) params.append('channel', query.channel);
    if (query?.type) params.append('type', query.type);
    if (query?.isRead !== undefined) params.append('isRead', String(query.isRead));
    if (query?.limit) params.append('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<NotificationRecordDto[]>(`/notifications${qs}`, { token });
  },

  sendNotification: (token: string, input: SendNotificationInput) =>
    request<NotificationRecordDto>('/notifications/send', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  markNotificationRead: (token: string, id: string) =>
    request<NotificationRecordDto>(`/notifications/${id}/read`, {
      method: 'PATCH',
      token,
    }),

  markAllNotificationsRead: (token: string) =>
    request<{ updatedCount: number }>('/notifications/read-all', {
      method: 'POST',
      token,
    }),

  getNotificationConfig: (token: string) =>
    request<NotificationConfigDto>('/notifications/config', { token }),

  updateNotificationConfig: (token: string, input: UpdateNotificationConfigInput) =>
    request<NotificationConfigDto>('/notifications/config', {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  getNotificationStats: (token: string) =>
    request<NotificationStatsDto>('/notifications/stats', { token }),

  sendTestNotification: (token: string) =>
    request<NotificationRecordDto>('/notifications/test', {
      method: 'POST',
      token,
    }),

  // ─── Reporting & BI Analytics ──────────────────────────────────
  getExecutiveReport: (token: string, query?: ReportDateRangeQuery) => {
    const params = new URLSearchParams();
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.locationId) params.append('locationId', query.locationId);
    if (query?.interval) params.append('interval', query.interval);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<ExecutiveReportSummaryDto>(`/reports/summary${qs}`, { token });
  },

  exportReportCsv: (token: string, query: ExportReportQuery) => {
    const params = new URLSearchParams();
    params.append('type', query.type);
    if (query.startDate) params.append('startDate', query.startDate);
    if (query.endDate) params.append('endDate', query.endDate);
    if (query.locationId) params.append('locationId', query.locationId);
    return request<{ filename: string; csv: string }>(`/reports/export?${params.toString()}`, { token });
  },

  // ─── Finance & Accounting Platform ─────────────────────────────
  listAccounts: (token: string) =>
    request<AccountDto[]>('/finance/accounts', { token }),

  createAccount: (token: string, input: CreateAccountInput) =>
    request<AccountDto>('/finance/accounts', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updateAccount: (token: string, id: string, input: UpdateAccountInput) =>
    request<AccountDto>(`/finance/accounts/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  listJournalEntries: (token: string, status?: JournalEntryStatus) => {
    const qs = status ? `?status=${status}` : '';
    return request<JournalEntryDto[]>(`/finance/journals${qs}`, { token });
  },

  getJournalEntry: (token: string, id: string) =>
    request<JournalEntryDto>(`/finance/journals/${id}`, { token }),

  createJournalEntry: (token: string, input: CreateJournalEntryInput) =>
    request<JournalEntryDto>('/finance/journals', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  postJournalEntry: (token: string, id: string) =>
    request<JournalEntryDto>(`/finance/journals/${id}/post`, {
      method: 'POST',
      token,
    }),

  voidJournalEntry: (token: string, id: string) =>
    request<JournalEntryDto>(`/finance/journals/${id}/void`, {
      method: 'POST',
      token,
    }),

  getTrialBalance: (token: string, query?: FinancialStatementQuery) => {
    const params = new URLSearchParams();
    if (query?.asOfDate) params.append('asOfDate', query.asOfDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<TrialBalanceDto>(`/finance/statements/trial-balance${qs}`, { token });
  },

  getIncomeStatement: (token: string, query?: FinancialStatementQuery) => {
    const params = new URLSearchParams();
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<IncomeStatementDto>(`/finance/statements/income-statement${qs}`, { token });
  },

  getBalanceSheet: (token: string, query?: FinancialStatementQuery) => {
    const params = new URLSearchParams();
    if (query?.asOfDate) params.append('asOfDate', query.asOfDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<BalanceSheetDto>(`/finance/statements/balance-sheet${qs}`, { token });
  },

  getFinanceSummary: (token: string) =>
    request<FinanceSummaryDto>('/finance/summary', { token }),

  // ─── Workflow & Approvals Engine ────────────────────────────────
  listWorkflowInstances: (token: string, status?: WorkflowStatus) => {
    const qs = status ? `?status=${status}` : '';
    return request<WorkflowInstanceDto[]>(`/workflows/instances${qs}`, { token });
  },

  getWorkflowInstance: (token: string, id: string) =>
    request<WorkflowInstanceDto>(`/workflows/instances/${id}`, { token }),

  submitWorkflowApproval: (token: string, input: SubmitApprovalInput) =>
    request<WorkflowInstanceDto>('/workflows/instances', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  reviewWorkflowStep: (
    token: string,
    instanceId: string,
    stepId: string,
    input: ReviewWorkflowStepInput,
  ) =>
    request<WorkflowInstanceDto>(`/workflows/instances/${instanceId}/steps/${stepId}/review`, {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  // ─── HR & Payroll Platform ──────────────────────────────────────
  listDepartments: (token: string) =>
    request<DepartmentDto[]>('/hr/departments', { token }),

  createDepartment: (token: string, input: CreateDepartmentInput) =>
    request<DepartmentDto>('/hr/departments', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  listEmployees: (token: string) =>
    request<EmployeeDto[]>('/hr/employees', { token }),

  getEmployee: (token: string, id: string) =>
    request<EmployeeDto>(`/hr/employees/${id}`, { token }),

  createEmployee: (token: string, input: CreateEmployeeInput) =>
    request<EmployeeDto>('/hr/employees', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  listLeaveRequests: (token: string) =>
    request<LeaveRequestDto[]>('/hr/leaves', { token }),

  createLeaveRequest: (token: string, input: CreateLeaveRequestInput) =>
    request<LeaveRequestDto>('/hr/leaves', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  approveLeaveRequest: (token: string, id: string) =>
    request<LeaveRequestDto>(`/hr/leaves/${id}/approve`, {
      method: 'POST',
      token,
    }),

  rejectLeaveRequest: (token: string, id: string) =>
    request<LeaveRequestDto>(`/hr/leaves/${id}/reject`, {
      method: 'POST',
      token,
    }),

  listPayrollRuns: (token: string) =>
    request<PayrollRunDto[]>('/hr/payroll', { token }),

  createPayrollRun: (token: string, input: CreatePayrollRunInput) =>
    request<PayrollRunDto>('/hr/payroll', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Fixed Assets Platform ──────────────────────────────────────
  listAssets: (token: string) =>
    request<FixedAssetDto[]>('/assets', { token }),

  getAsset: (token: string, id: string) =>
    request<FixedAssetDto>(`/assets/${id}`, { token }),

  createAsset: (token: string, input: CreateFixedAssetInput) =>
    request<FixedAssetDto>('/assets', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  runDepreciation: (token: string, id: string) =>
    request<DepreciationRecordDto>(`/assets/${id}/depreciate`, {
      method: 'POST',
      token,
    }),

  // ─── Projects & Billing ─────────────────────────────────────────
  listProjects: (token: string) =>
    request<ProjectDto[]>('/projects', { token }),

  getProject: (token: string, id: string) =>
    request<ProjectDto>(`/projects/${id}`, { token }),

  createProject: (token: string, input: CreateProjectInput) =>
    request<ProjectDto>('/projects', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  createProjectTask: (token: string, projectId: string, input: CreateProjectTaskInput) =>
    request<ProjectTaskDto>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  logTimesheet: (token: string, taskId: string, input: LogTimesheetInput) =>
    request<TimesheetEntryDto>(`/projects/tasks/${taskId}/timesheets`, {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  // ─── Service Management & Helpdesk ──────────────────────────────
  listTickets: (token: string, status?: TicketStatus, priority?: TicketPriority) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<ServiceTicketDto[]>(`/tickets${qs}`, { token });
  },

  getTicket: (token: string, id: string) =>
    request<ServiceTicketDto>(`/tickets/${id}`, { token }),

  createTicket: (token: string, input: CreateServiceTicketInput) =>
    request<ServiceTicketDto>('/tickets', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  addTicketComment: (token: string, ticketId: string, input: AddTicketCommentInput) =>
    request<TicketCommentDto>(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updateTicketStatus: (token: string, ticketId: string, status: TicketStatus, resolution?: string) =>
    request<ServiceTicketDto>(`/tickets/${ticketId}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status, resolution }),
    }),

  // ─── Partner & Developer Platform ───────────────────────────────
  listDeveloperApps: (token: string) =>
    request<DeveloperAppDto[]>('/developers/apps', { token }),

  createDeveloperApp: (token: string, input: CreateDeveloperAppInput) =>
    request<DeveloperAppDto>('/developers/apps', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  listApiKeys: (token: string) =>
    request<ApiKeyDto[]>('/developers/keys', { token }),

  createApiKey: (token: string, input: CreateApiKeyInput) =>
    request<CreateApiKeyResultDto>('/developers/keys', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  revokeApiKey: (token: string, id: string) =>
    request<ApiKeyDto>(`/developers/keys/${id}`, {
      method: 'DELETE',
      token,
    }),

  listWebhookSubscriptions: (token: string) =>
    request<WebhookSubscriptionDto[]>('/developers/webhooks', { token }),

  createWebhookSubscription: (token: string, input: CreateWebhookSubscriptionInput) =>
    request<WebhookSubscriptionDto>('/developers/webhooks', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  deleteWebhookSubscription: (token: string, id: string) =>
    request<{ success: boolean }>(`/developers/webhooks/${id}`, {
      method: 'DELETE',
      token,
    }),

  // ─── Telegram Platform ──────────────────────────────────────────
  listTelegramBindings: (token: string) =>
    request<TelegramChatBindingDto[]>('/telegram/bindings', { token }),

  bindTelegramChat: (token: string, input: BindTelegramChatInput) =>
    request<TelegramChatBindingDto>('/telegram/bindings', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  deleteTelegramBinding: (token: string, id: string) =>
    request<{ success: boolean }>(`/telegram/bindings/${id}`, {
      method: 'DELETE',
      token,
    }),

  sendTelegramBroadcast: (token: string, message: string) =>
    request<{ sentCount: number }>('/telegram/broadcast', {
      method: 'POST',
      token,
      body: JSON.stringify({ message }),
    }),

  // ─── Flow Automation Platform (n8n Engine) ───────────────────────
  listFlows: (token: string) =>
    request<AutomationFlowDto[]>('/flows', { token }),

  getFlow: (token: string, id: string) =>
    request<AutomationFlowDto>(`/flows/${id}`, { token }),

  createFlow: (token: string, input: CreateFlowInput) =>
    request<AutomationFlowDto>('/flows', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  updateFlow: (token: string, id: string, input: UpdateFlowInput) =>
    request<AutomationFlowDto>(`/flows/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  deleteFlow: (token: string, id: string) =>
    request<{ success: boolean }>(`/flows/${id}`, {
      method: 'DELETE',
      token,
    }),

  executeFlow: (token: string, id: string, payload: Record<string, any> = {}) =>
    request<FlowExecutionDto>(`/flows/${id}/execute`, {
      method: 'POST',
      token,
      body: JSON.stringify({ payload }),
    }),

  listFlowExecutions: (token: string, id: string) =>
    request<FlowExecutionDto[]>(`/flows/${id}/executions`, { token }),

  // ─── Delivery & Fleet Dispatch (Spec §45) ─────────────────────────
  listDeliveryOrders: (token: string, params: { status?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<DeliveryOrderDto[]>(`/delivery/orders${q ? `?${q}` : ''}`, { token });
  },

  createDeliveryOrder: (token: string, input: CreateDeliveryOrderInput) =>
    request<DeliveryOrderDto>('/delivery/orders', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  getDeliveryOrder: (token: string, id: string) =>
    request<DeliveryOrderDto>(`/delivery/orders/${id}`, { token }),

  updateDeliveryStatus: (
    token: string,
    id: string,
    input: { status: string; proofOfDelivery?: string; notes?: string }
  ) =>
    request<DeliveryOrderDto>(`/delivery/orders/${id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(input),
    }),

  assignDriver: (token: string, orderId: string, driverId: string) =>
    request<DeliveryOrderDto>(`/delivery/orders/${orderId}/assign`, {
      method: 'POST',
      token,
      body: JSON.stringify({ driverId }),
    }),

  listDrivers: (token: string) =>
    request<DeliveryDriverDto[]>('/delivery/drivers', { token }),

  createDriver: (token: string, input: CreateDriverInput) =>
    request<DeliveryDriverDto>('/delivery/drivers', {
      method: 'POST',
      token,
      body: JSON.stringify(input),
    }),

  pingDriverLocation: (
    token: string,
    driverId: string,
    data: { latitude: number; longitude: number; heading?: number; batteryLevel?: number }
  ) =>
    request<DeliveryDriverDto>(`/delivery/drivers/${driverId}/location`, {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  getLiveTrackingSnapshot: (token: string) =>
    request<LiveTrackingSnapshotDto>('/delivery/live-tracking', { token }),

  // ─── AI Copilot Assistant (Spec §68-§71) ──────────────────────────
  copilotChat: (token: string, message: string, pageContext?: string) =>
    request<CopilotChatResponse>('/ai/chat', {
      method: 'POST',
      token,
      body: JSON.stringify({ message, pageContext }),
    }),

  getCopilotSuggestions: (token: string, context: string = 'dashboard') =>
    request<{ context: string; prompts: string[] }>(`/ai/suggestions?context=${context}`, {
      token,
    }),

  // ─── Industry Verticals (Spec §17-§22, §112) ──────────────────────
  getIndustryConfig: (token: string) =>
    request<IndustryConfigDto>('/industry/config', { token }),

  setupIndustryPreset: (token: string, preset: string) =>
    request<IndustryConfigDto>('/industry/setup', {
      method: 'POST',
      token,
      body: JSON.stringify({ preset }),
    }),

  listTables: (token: string) =>
    request<TableDto[]>('/industry/restaurant/tables', { token }),

  listKDSTickets: (token: string) =>
    request<KDSTicketDto[]>('/industry/restaurant/kds', { token }),
};


