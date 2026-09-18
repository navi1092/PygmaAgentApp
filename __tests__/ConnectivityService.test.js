jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(), addEventListener: jest.fn(),
}));
jest.mock('react-native', () => ({AppState: {currentState: 'active'}}));
jest.mock('../src/services/ApiService', () => ({
  syncOfflineQueue: jest.fn(),
}));
const network = require('@react-native-community/netinfo');
const {AppState} = require('react-native');
const api = require('../src/services/ApiService');
const connectivity = require('../src/services/ConnectivityService').default;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  AppState.currentState = 'active';
  network.addEventListener.mockReturnValue(jest.fn());
  network.fetch.mockResolvedValue({isConnected: true});
  api.syncOfflineQueue.mockResolvedValue({attempted: 1, remaining: 0, errors: []});
});
afterEach(() => {
  connectivity.stop();
  jest.useRealTimers();
});

test('retries transient failures without another connectivity event and backs off', async () => {
  api.syncOfflineQueue.mockResolvedValueOnce({attempted: 1, remaining: 600, errors: ['Unavailable']});
  connectivity.start();
  await jest.advanceTimersByTimeAsync(30000);
  expect(api.syncOfflineQueue).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(59999);
  expect(api.syncOfflineQueue).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(api.syncOfflineQueue).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(30000);
  expect(api.syncOfflineQueue).toHaveBeenCalledTimes(3);
});

test('stopping service cancels scheduled retries', async () => {
  connectivity.start();
  connectivity.stop();
  await jest.advanceTimersByTimeAsync(300000);
  expect(api.syncOfflineQueue).not.toHaveBeenCalled();
});

test('background skips timers and foreground resume restarts syncing', async () => {
  connectivity.start();
  AppState.currentState = 'background';
  await jest.advanceTimersByTimeAsync(30000);
  expect(api.syncOfflineQueue).not.toHaveBeenCalled();
  AppState.currentState = 'active';
  await connectivity.syncIfOnline();
  expect(api.syncOfflineQueue).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(30000);
  expect(api.syncOfflineQueue).toHaveBeenCalledTimes(2);
});
