import type { Bill, Subscription, SubscriptionEvent, Transaction, PaymentConnection } from '../types';

const DB_NAME = 'SubDashDB';
const DB_VERSION = 2; // Updated version for enhanced schema
const BILLS_STORE = 'bills';
const SUBS_STORE = 'subscriptions';
const TRANSACTIONS_STORE = 'transactions';
const SUBSCRIPTION_EVENTS_STORE = 'subscription_events';
const PAYMENT_CONNECTIONS_STORE = 'payment_connections';

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

      // Bills store
      if (!dbInstance.objectStoreNames.contains(BILLS_STORE)) {
        dbInstance.createObjectStore(BILLS_STORE, { keyPath: 'id' });
      }

      // Subscriptions store (enhanced)
      if (!dbInstance.objectStoreNames.contains(SUBS_STORE)) {
        dbInstance.createObjectStore(SUBS_STORE, { keyPath: 'id' });
      }

      // Transactions store
      if (!dbInstance.objectStoreNames.contains(TRANSACTIONS_STORE)) {
        const transactionStore = dbInstance.createObjectStore(TRANSACTIONS_STORE, { keyPath: 'id' });
        transactionStore.createIndex('subscriptionId', 'subscriptionId', { unique: false });
        transactionStore.createIndex('transactionDate', 'transactionDate', { unique: false });
        transactionStore.createIndex('status', 'status', { unique: false });
      }

      // Subscription events store
      if (!dbInstance.objectStoreNames.contains(SUBSCRIPTION_EVENTS_STORE)) {
        const eventStore = dbInstance.createObjectStore(SUBSCRIPTION_EVENTS_STORE, { keyPath: 'id' });
        eventStore.createIndex('subscriptionId', 'subscriptionId', { unique: false });
        eventStore.createIndex('eventDate', 'eventDate', { unique: false });
        eventStore.createIndex('eventType', 'eventType', { unique: false });
      }

      // Payment connections store
      if (!dbInstance.objectStoreNames.contains(PAYMENT_CONNECTIONS_STORE)) {
        const connectionStore = dbInstance.createObjectStore(PAYMENT_CONNECTIONS_STORE, { keyPath: 'id' });
        connectionStore.createIndex('provider', 'provider', { unique: false });
        connectionStore.createIndex('isActive', 'isActive', { unique: false });
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



// Enhanced Subscription Operations
export const getAllSubscriptions = async (): Promise<Subscription[]> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(SUBS_STORE, 'readonly').getAll();
        request.onsuccess = () => {
            const subscriptions = request.result.map(s => ({
                ...s,
                nextBillingDate: new Date(s.nextBillingDate),
                startDate: new Date(s.startDate),
                endDate: s.endDate ? new Date(s.endDate) : undefined,
                trialEndDate: s.trialEndDate ? new Date(s.trialEndDate) : undefined,
                createdAt: new Date(s.createdAt),
                updatedAt: new Date(s.updatedAt)
            }));
            resolve(subscriptions);
        };
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

// Transaction Operations
export const getAllTransactions = async (): Promise<Transaction[]> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(TRANSACTIONS_STORE, 'readonly').getAll();
        request.onsuccess = () => {
            const transactions = request.result.map(t => ({
                ...t,
                transactionDate: new Date(t.transactionDate),
                createdAt: new Date(t.createdAt)
            }));
            resolve(transactions);
        };
        request.onerror = () => reject('Error fetching transactions');
    });
};

export const getTransactionsBySubscription = async (subscriptionId: string): Promise<Transaction[]> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const index = getStore(TRANSACTIONS_STORE, 'readonly').index('subscriptionId');
        const request = index.getAll(subscriptionId);
        request.onsuccess = () => {
            const transactions = request.result.map(t => ({
                ...t,
                transactionDate: new Date(t.transactionDate),
                createdAt: new Date(t.createdAt)
            }));
            resolve(transactions);
        };
        request.onerror = () => reject('Error fetching transactions by subscription');
    });
};

export const saveTransaction = async (transaction: Transaction): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(TRANSACTIONS_STORE, 'readwrite').put(transaction);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error saving transaction');
    });
};

export const deleteTransaction = async (id: string): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(TRANSACTIONS_STORE, 'readwrite').delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error deleting transaction');
    });
};

// Subscription Event Operations
export const getAllSubscriptionEvents = async (): Promise<SubscriptionEvent[]> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(SUBSCRIPTION_EVENTS_STORE, 'readonly').getAll();
        request.onsuccess = () => {
            const events = request.result.map(e => ({
                ...e,
                eventDate: new Date(e.eventDate),
                createdAt: new Date(e.createdAt)
            }));
            resolve(events);
        };
        request.onerror = () => reject('Error fetching subscription events');
    });
};

export const getSubscriptionEventsBySubscription = async (subscriptionId: string): Promise<SubscriptionEvent[]> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const index = getStore(SUBSCRIPTION_EVENTS_STORE, 'readonly').index('subscriptionId');
        const request = index.getAll(subscriptionId);
        request.onsuccess = () => {
            const events = request.result.map(e => ({
                ...e,
                eventDate: new Date(e.eventDate),
                createdAt: new Date(e.createdAt)
            }));
            resolve(events);
        };
        request.onerror = () => reject('Error fetching subscription events by subscription');
    });
};

export const saveSubscriptionEvent = async (event: SubscriptionEvent): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(SUBSCRIPTION_EVENTS_STORE, 'readwrite').put(event);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error saving subscription event');
    });
};

export const deleteSubscriptionEvent = async (id: string): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(SUBSCRIPTION_EVENTS_STORE, 'readwrite').delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error deleting subscription event');
    });
};

// Payment Connection Operations
export const getAllPaymentConnections = async (): Promise<PaymentConnection[]> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(PAYMENT_CONNECTIONS_STORE, 'readonly').getAll();
        request.onsuccess = () => {
            const connections = request.result.map(c => ({
                ...c,
                lastSyncDate: c.lastSyncDate ? new Date(c.lastSyncDate) : undefined,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt)
            }));
            resolve(connections);
        };
        request.onerror = () => reject('Error fetching payment connections');
    });
};

export const getPaymentConnectionByProvider = async (provider: string): Promise<PaymentConnection | null> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const index = getStore(PAYMENT_CONNECTIONS_STORE, 'readonly').index('provider');
        const request = index.get(provider);
        request.onsuccess = () => {
            if (request.result) {
                const connection = {
                    ...request.result,
                    lastSyncDate: request.result.lastSyncDate ? new Date(request.result.lastSyncDate) : undefined,
                    createdAt: new Date(request.result.createdAt),
                    updatedAt: new Date(request.result.updatedAt)
                };
                resolve(connection);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject('Error fetching payment connection by provider');
    });
};

export const savePaymentConnection = async (connection: PaymentConnection): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(PAYMENT_CONNECTIONS_STORE, 'readwrite').put(connection);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error saving payment connection');
    });
};

export const deletePaymentConnection = async (id: string): Promise<void> => {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = getStore(PAYMENT_CONNECTIONS_STORE, 'readwrite').delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error deleting payment connection');
    });
};

export const clearAllData = async (): Promise<void> => {
    await initDB();
    const billStore = getStore(BILLS_STORE, 'readwrite');
    billStore.clear();
    const subStore = getStore(SUBS_STORE, 'readwrite');
    subStore.clear();
    const transactionStore = getStore(TRANSACTIONS_STORE, 'readwrite');
    transactionStore.clear();
    const eventStore = getStore(SUBSCRIPTION_EVENTS_STORE, 'readwrite');
    eventStore.clear();
    const connectionStore = getStore(PAYMENT_CONNECTIONS_STORE, 'readwrite');
    connectionStore.clear();
}
