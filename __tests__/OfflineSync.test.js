const mockPost = jest.fn();
let mockResponseError;
jest.mock('axios', () => ({create: () => ({
  post: mockPost,
  interceptors: {
    request: {use: jest.fn()},
    response: {use: (success, failure) => { mockResponseError = failure; }},
  },
})}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), multiRemove: jest.fn(),
}));
jest.mock('@react-native-community/netinfo', () => ({fetch: jest.fn()}));
jest.mock('../src/database/DatabaseService', () => ({
  migrateLegacyTransactionSyncStates: jest.fn(), getUnsyncedTransactions: jest.fn(),
  getTransactions: jest.fn(), getApiQueue: jest.fn(), insertApiQueue: jest.fn(),
  updateTransactionSyncState: jest.fn(), deleteApiQueueItem: jest.fn(),
  clearAllData: jest.fn(),
}));

const storage = require('@react-native-async-storage/async-storage');
const network = require('@react-native-community/netinfo');
const db = require('../src/database/DatabaseService');
let api;
let transactions;
let queue;
let session;

beforeEach(() => {
  jest.clearAllMocks();
  // Reload the module's session and single-flight state, retaining the mocks.
  jest.isolateModules(() => { api = require('../src/services/ApiService').default; });
  session = {loginKey: 'test-key', agentId: '1', bankId: '2'};
  storage.getItem.mockImplementation(async key => session[key] || null);
  storage.setItem.mockImplementation(async (key, value) => { session[key] = value; });
  storage.removeItem.mockImplementation(async key => { delete session[key]; });
  transactions = Array.from({length: 600}, (_, i) => ({
    TransactionId: String(i + 1), AccountId: i + 1, Amount: 500,
    tranDate: '2026-09-10T10:00:00.000Z', syncStatus: 0,
  }));
  queue = transactions.map(t => ({QueueId: t.TransactionId,
    Endpoint: 'Agent/updatetransaction', Params: JSON.stringify(t)}));
  db.getTransactions.mockImplementation(async () => transactions.map(t => ({...t})));
  db.getUnsyncedTransactions.mockImplementation(async () => transactions.filter(t => t.syncStatus === 0).map(t => ({...t})));
  db.getApiQueue.mockImplementation(async () => queue.map(q => ({...q})));
  db.insertApiQueue.mockImplementation(async q => { queue.push({...q, QueueId: String(queue.length + 1), Params: JSON.stringify(q.Params)}); });
  db.updateTransactionSyncState.mockImplementation(async (id, status) => {
    transactions.find(t => t.TransactionId === id).syncStatus = status;
  });
  db.deleteApiQueueItem.mockImplementation(async id => { queue = queue.filter(q => q.QueueId !== id); });
  network.fetch.mockResolvedValue({isConnected: true, isInternetReachable: true});
  mockPost.mockImplementation(async () => ({data: {statusCode: 200}}));
});

test('600 old receipts upload once even with concurrent sync callers', async () => {
  const results = await Promise.all([api.syncOfflineQueue(), api.syncOfflineQueue(), api.syncOfflineQueue()]);
  expect(mockPost).toHaveBeenCalledTimes(600);
  expect(results[0]).toMatchObject({uploaded: 600, remaining: 0});
  expect(queue).toHaveLength(0);
});

test('offline queue sends no requests and all 600 upload after reconnect', async () => {
  network.fetch.mockResolvedValueOnce({isConnected: false});
  expect(await api.syncOfflineQueue()).toMatchObject({attempted: 0, remaining: 600});
  expect(mockPost).not.toHaveBeenCalled();
  expect(queue).toHaveLength(600);
  expect(await api.syncOfflineQueue()).toMatchObject({uploaded: 600, remaining: 0});
});

test('network loss stops immediately and retries only the remaining receipts', async () => {
  mockPost.mockImplementation(async (endpoint, params) => {
    if (Number(params.TransactionId) > 300) throw new Error('Network Error');
    return {data: {statusCode: 200}};
  });
  expect(await api.syncOfflineQueue()).toMatchObject({attempted: 301, uploaded: 300, remaining: 300});
  mockPost.mockResolvedValue({data: {statusCode: 200}});
  expect(await api.syncOfflineQueue()).toMatchObject({uploaded: 300, remaining: 0});
});

test('401 preserves all data and owner IDs; same-agent login resumes uploads', async () => {
  mockPost.mockImplementationOnce(async () => mockResponseError(Object.assign(new Error('Unauthorized'), {response: {status: 401}})));
  expect(await api.syncOfflineQueue()).toMatchObject({attempted: 1, uploaded: 0, remaining: 600});
  expect(db.clearAllData).not.toHaveBeenCalled();
  expect(queue).toHaveLength(600);
  expect(session).toEqual({agentId: '1', bankId: '2'});
  expect(await api.syncOfflineQueue()).toMatchObject({attempted: 0, remaining: 600});
  mockPost.mockResolvedValueOnce({data: {statusCode: 200, responseData: {LoginKey: 'new-key', AgentId: 1, BankId: 2}}});
  await api.verifyOtp('123', '123456', {}, 1);
  expect(await api.syncOfflineQueue()).toMatchObject({uploaded: 600, remaining: 0});
});

test('another agent cannot adopt pending collections', async () => {
  mockPost.mockResolvedValueOnce({data: {statusCode: 200, responseData: {LoginKey: 'other-key', AgentId: 99, BankId: 2}}});
  await expect(api.verifyOtp('123', '123456', {}, 1)).rejects.toMatchObject({message: expect.stringContaining('previous agent')});
  expect(session.agentId).toBe('1');
  expect(db.clearAllData).not.toHaveBeenCalled();
});

test('missing queue rows recover from persisted pending receipts', async () => {
  queue = [];
  expect(await api.syncOfflineQueue()).toMatchObject({uploaded: 600, remaining: 0});
});

test('failure removing an acknowledged queue row never resends its receipt', async () => {
  db.deleteApiQueueItem.mockRejectedValueOnce(new Error('disk busy'));
  await api.syncOfflineQueue();
  expect(transactions[0].syncStatus).toBe(1);
  await api.syncOfflineQueue();
  expect(mockPost.mock.calls.filter(([, t]) => t.TransactionId === '1')).toHaveLength(1);
  expect(queue).toHaveLength(0);
});

test('server errors retain queue and stop the batch', async () => {
  mockPost.mockRejectedValueOnce(Object.assign(new Error('Unavailable'), {response: {status: 503}}));
  expect(await api.syncOfflineQueue()).toMatchObject({attempted: 1, remaining: 600});
  expect(queue).toHaveLength(600);
});

test('app restart after expiry cannot upload without reauthentication', async () => {
  delete session.loginKey;
  jest.isolateModules(() => { api = require('../src/services/ApiService').default; });
  expect(await api.syncOfflineQueue()).toMatchObject({attempted: 0, remaining: 600});
  expect(mockPost).not.toHaveBeenCalled();
  expect(queue).toHaveLength(600);
});

test('backend validation failure retains that receipt and continues other uploads', async () => {
  mockPost.mockResolvedValueOnce({data: {statusCode: 400, message: 'Receipt rejected'}});
  expect(await api.syncOfflineQueue()).toMatchObject({uploaded: 599, remaining: 1});
  expect(queue).toHaveLength(1);
  expect(transactions[0].syncStatus).toBe(0);
});

test('logout is blocked while receipts remain pending', async () => {
  await expect(api.logout()).rejects.toThrow('Upload pending collections');
  expect(storage.multiRemove).not.toHaveBeenCalled();
});
