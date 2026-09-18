import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import ApiService from './ApiService';

// Retry persisted uploads on reconnect and periodically while the app is
// active. App.js resumes this service when returning from the background.
let unsubscribe = null;
let isSyncing = false;
let retryTimer = null;
let started = false;
let retryDelay = 30000;
const syncListeners = new Set();

const isOnline = (state) => state.isConnected === true
  && state.isInternetReachable !== false;

const runPendingSync = async () => {
  if (isSyncing) return;
  if (AppState.currentState && AppState.currentState !== 'active') return;
  isSyncing = true;
  clearTimeout(retryTimer);
  try {
    const result = await ApiService.syncOfflineQueue();
    retryDelay = result?.errors?.length ? Math.min(retryDelay * 2, 300000) : 30000;
    if (result?.attempted > 0) syncListeners.forEach((listener) => {
      Promise.resolve().then(() => listener(result)).catch((error) => {
        console.log('Sync listener failed:', error.message || error);
      });
    });
    return result;
  } catch (error) {
    // The queue retains failures for the next reconnect, matching WorkManager.
    console.log('Reconnect sync failed:', error.message || error);
  } finally {
    isSyncing = false;
    if (started) retryTimer = setTimeout(runPendingSync, retryDelay);
  }
};

const ConnectivityService = {
  start: () => {
    if (unsubscribe) return unsubscribe;
    started = true;
    unsubscribe = NetInfo.addEventListener((state) => {
      if (isOnline(state)) runPendingSync();
    });
    retryTimer = setTimeout(runPendingSync, retryDelay);
    return unsubscribe;
  },

  stop: () => {
    started = false;
    clearTimeout(retryTimer);
    retryDelay = 30000;
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
