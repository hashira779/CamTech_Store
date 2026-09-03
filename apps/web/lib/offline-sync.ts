import type {
  OfflineSalePayload,
  SyncBatchResponseDto,
  ProductDto,
  CustomerDto,
} from '@mystore/contracts';
import { api } from './api-client';

const DB_NAME = 'mystore_pos_offline';
const DB_VERSION = 1;

const STORES = {
  SALES: 'offline_sales',
  CATALOG: 'cached_catalog',
  CUSTOMERS: 'cached_customers',
} as const;

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Offline Sales Queue
      if (!db.objectStoreNames.contains(STORES.SALES)) {
        const salesStore = db.createObjectStore(STORES.SALES, { keyPath: 'localId' });
        salesStore.createIndex('clientCreatedAt', 'clientCreatedAt', { unique: false });
      }

      // 2. Cached Product Catalog
      if (!db.objectStoreNames.contains(STORES.CATALOG)) {
        db.createObjectStore(STORES.CATALOG, { keyPath: 'id' });
      }

      // 3. Cached Customers
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Offline Sales Queue Operations
// ---------------------------------------------------------------------------

export async function enqueueOfflineSale(sale: OfflineSalePayload): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SALES, 'readwrite');
    const store = tx.objectStore(STORES.SALES);
    const req = store.put(sale);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingOfflineSales(): Promise<OfflineSalePayload[]> {
  if (!isIndexedDbAvailable()) return [];
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SALES, 'readonly');
    const store = tx.objectStore(STORES.SALES);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineSale(localId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SALES, 'readwrite');
    const store = tx.objectStore(STORES.SALES);
    const req = store.delete(localId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllOfflineSales(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.SALES, 'readwrite');
    const store = tx.objectStore(STORES.SALES);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Offline Catalog & Customer Cache
// ---------------------------------------------------------------------------

export async function cacheCatalog(products: ProductDto[]): Promise<void> {
  if (!isIndexedDbAvailable() || !products.length) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CATALOG, 'readwrite');
    const store = tx.objectStore(STORES.CATALOG);
    store.clear();
    products.forEach((p) => store.put(p));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedCatalog(): Promise<ProductDto[]> {
  if (!isIndexedDbAvailable()) return [];
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CATALOG, 'readonly');
    const store = tx.objectStore(STORES.CATALOG);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheCustomers(customers: CustomerDto[]): Promise<void> {
  if (!isIndexedDbAvailable() || !customers.length) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOMERS, 'readwrite');
    const store = tx.objectStore(STORES.CUSTOMERS);
    store.clear();
    customers.forEach((c) => store.put(c));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedCustomers(): Promise<CustomerDto[]> {
  if (!isIndexedDbAvailable()) return [];
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOMERS, 'readonly');
    const store = tx.objectStore(STORES.CUSTOMERS);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Queue Synchronization Engine (Spec §17, §18)
// ---------------------------------------------------------------------------

export async function syncOfflineSales(token: string): Promise<SyncBatchResponseDto | null> {
  const pending = await getPendingOfflineSales();
  if (pending.length === 0) {
    return null;
  }

  // Send batch to backend
  const response = await api.syncSalesBatch(token, { sales: pending });

  // Remove successfully synced or duplicate entries from local queue
  for (const res of response.results) {
    if (res.status === 'SYNCED' || res.status === 'DUPLICATE') {
      await removeOfflineSale(res.localId);
    }
  }

  return response;
}
