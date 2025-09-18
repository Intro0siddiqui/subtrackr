import type { Bill, Subscription } from '../types';

const DB_NAME = 'SubTrackrDB';
const DB_VERSION = 1;
const BILLS_STORE = 'bills';
const SUBS_STORE = 'subscriptions';

let db: IDBDatabase;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Error opening IndexedDB");
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(BILLS_STORE)) {
        dbInstance.createObjectStore(BILLS_STORE, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(SUBS_STORE)) {
        dbInstance.createObjectStore(SUBS_STORE, { keyPath: 'id' });
      }
    };
  });
};

const getStore = (storeName: string, mode: IDBTransactionMode) => {
    return db.transaction(storeName, mode).objectStore(storeName);
}

// Bill Operations
export const getAllBills = async (): Promise<Bill[]> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(BILLS_STORE, 'readonly').getAll();
        request.onsuccess = () => resolve(request.result.map(b => ({...b, dueDate: new Date(b.dueDate)})));
        request.onerror = () => reject('Error fetching bills');
    });
};

export const saveBill = async (bill: Bill): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(BILLS_STORE, 'readwrite').put(bill);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error saving bill');
    });
}

export const deleteBill = async (id: string): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(BILLS_STORE, 'readwrite').delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error deleting bill');
    });
}

export const syncBills = async (bills: Bill[]): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(BILLS_STORE, 'readwrite');
        const store = tx.objectStore(BILLS_STORE);
        store.clear();
        bills.forEach(bill => store.put(bill));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject('Error syncing bills');
    });
}


// Subscription Operations
export const getAllSubscriptions = async (): Promise<Subscription[]> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(SUBS_STORE, 'readonly').getAll();
        request.onsuccess = () => resolve(request.result.map(s => ({...s, nextBillingDate: new Date(s.nextBillingDate)})));
        request.onerror = () => reject('Error fetching subscriptions');
    });
};

export const saveSubscription = async (sub: Subscription): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(SUBS_STORE, 'readwrite').put(sub);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error saving subscription');
    });
}

export const deleteSubscription = async (id: string): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(SUBS_STORE, 'readwrite').delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error deleting subscription');
    });
}

export const syncSubscriptions = async (subs: Subscription[]): Promise<void> => {
    await initDB();
     return new Promise((resolve, reject) => {
        const tx = db.transaction(SUBS_STORE, 'readwrite');
        const store = tx.objectStore(SUBS_STORE);
        store.clear();
        subs.forEach(sub => store.put(sub));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject('Error syncing subscriptions');
    });
}

export const clearAllData = async (): Promise<void> => {
    await initDB();
    const billStore = getStore(BILLS_STORE, 'readwrite');
    billStore.clear();
    const subStore = getStore(SUBS_STORE, 'readwrite');
    subStore.clear();
}
