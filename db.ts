import { Campaign, Entry } from './types';

const DB_NAME = 'DataCaptureDB';
const DB_VERSION = 1;

export const STORES = {
  CAMPAIGNS: 'campaigns',
  ENTRIES: 'entries',
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.CAMPAIGNS)) {
        db.createObjectStore(STORES.CAMPAIGNS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ENTRIES)) {
        const entryStore = db.createObjectStore(STORES.ENTRIES, { keyPath: 'id' });
        entryStore.createIndex('campaignId', 'campaignId', { unique: false });
        entryStore.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
};

export const db = {
  async saveCampaign(campaign: Campaign): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CAMPAIGNS, 'readwrite');
      const store = tx.objectStore(STORES.CAMPAIGNS);
      const req = store.put(campaign);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async deleteCampaign(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.CAMPAIGNS, STORES.ENTRIES], 'readwrite');
      
      // Delete campaign
      tx.objectStore(STORES.CAMPAIGNS).delete(id);
      
      // Delete associated entries
      const entryStore = tx.objectStore(STORES.ENTRIES);
      const index = entryStore.index('campaignId');
      const req = index.getAllKeys(id);
      
      req.onsuccess = () => {
        const keys = req.result;
        keys.forEach(key => entryStore.delete(key));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getCampaigns(): Promise<Campaign[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CAMPAIGNS, 'readonly');
      const store = tx.objectStore(STORES.CAMPAIGNS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CAMPAIGNS, 'readonly');
      const store = tx.objectStore(STORES.CAMPAIGNS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveEntry(entry: Entry): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTRIES, 'readwrite');
      const store = tx.objectStore(STORES.ENTRIES);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async deleteEntry(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTRIES, 'readwrite');
      const store = tx.objectStore(STORES.ENTRIES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getEntries(campaignId: string): Promise<Entry[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ENTRIES, 'readonly');
      const store = tx.objectStore(STORES.ENTRIES);
      const index = store.index('campaignId');
      const req = index.getAll(campaignId);
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  },

  async getUnsyncedEntries(campaignId: string): Promise<Entry[]> {
    const entries = await this.getEntries(campaignId);
    return entries.filter(e => !e.synced);
  },
  
  async markSynced(entryIds: string[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.ENTRIES, 'readwrite');
    const store = tx.objectStore(STORES.ENTRIES);
    
    // Process serially within transaction
    for (const id of entryIds) {
      await new Promise<void>((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const entry = getReq.result;
          if (entry) {
            entry.synced = true;
            store.put(entry).onsuccess = () => resolve();
          } else {
            resolve();
          }
        };
        getReq.onerror = () => reject(getReq.error);
      });
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};