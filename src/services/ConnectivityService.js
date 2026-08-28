import NetInfo from '@react-native-community/netinfo';
import ApiService from './ApiService';

// Android schedules ApiSyncWorker with a CONNECTED network constraint. This
// small foreground equivalent retries the same local queue each time iOS
// regains internet access. Queued work remains in SQLite until its API call
// succeeds, so it is safe to retry.
let unsubscribe = null;
let isSyncing = false;
const syncListeners = new Set();

const isOnline = (state) => state.isConnected === true
  && state.isInternetReachable !== false;

const runPendingSync = async () => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const result = await ApiService.syncOfflineQueue();
    syncListeners.forEach((listener) => listener(result));
    return result;
  } catch (error) {
    // The queue retains failures for the next reconnect, matching WorkManager.
    console.log('Reconnect sync failed:', error.message || error);
  } finally {
    isSyncing = false;
  }
};

const ConnectivityService = {
  start: () => {
    if (unsubscribe) return unsubscribe;
    unsubscribe = NetInfo.addEventListener((state) => {
      if (isOnline(state)) runPendingSync();
    });
    return unsubscribe;
  },

  stop: () => {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  },

  syncIfOnline: async () => {
    const state = await NetInfo.fetch();
    if (isOnline(state)) await runPendingSync();
  },

  subscribe: (listener) => {
    syncListeners.add(listener);
    return () => syncListeners.delete(listener);
  },
};

export default ConnectivityService;
