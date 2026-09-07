import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../database/DatabaseService';

// ============================================================================
// Base URL — confirmed from android/app/build.gradle buildConfigField SERVER_URL
// ============================================================================
// "live" flavor:  https://pygmaapi.unigs.in/api/
// "demo" flavor:  https://demopygmaapi.unigs.in/api/
const API_BASE_URL = 'https://pygmaapi.unigs.in/api/';
const ACCOUNT_DOWNLOAD_TIME_FLAG_KEY = 'accountDownloadTimeFlag';
// Matches Android's SessionManager.isSessionExpired guard.
let isSessionExpired = false;
let sessionExpiredHandler = null;

// APP_VERSION_CODE matches BuildConfig.VERSION_CODE sent as AppVersionId header
// (see android/app/build.gradle versionCode) — update if the backend requires
// a specific minimum version.
const APP_VERSION_CODE = '12';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Auth headers — confirmed from AuthInterceptor.java exactly.
// The original app does NOT use Authorization: Bearer — it uses these three
// custom headers instead, populated from AsyncStorage after login.
// ============================================================================
apiClient.interceptors.request.use(
  async (config) => {
    try {
      config.headers['API-Version'] = '1.2';
      config.headers['AppVersionId'] = APP_VERSION_CODE;

      const loginKey = await AsyncStorage.getItem('loginKey');
      const agentId = await AsyncStorage.getItem('agentId');
      const bankId = await AsyncStorage.getItem('bankId');

      console.log('Auth headers available:', {
        loginKey: Boolean(loginKey),
        agentId: Boolean(agentId && agentId !== '0'),
        bankId: Boolean(bankId && bankId !== '0'),
      });

      if (loginKey) config.headers['Login-Key'] = loginKey;
      if (agentId) config.headers['AgentID'] = agentId;
      if (bankId) config.headers['BankID'] = bankId;
    } catch (error) {
      console.log('Error attaching auth headers:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 globally, matching AuthInterceptor.java's session-expiry logic
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isSessionExpired) {
      isSessionExpired = true;
      try {
        // Android AuthInterceptor does AppData.clearTokens(), then
        // BaseRepository.clearDb() / Room clearAllTables().
        await AsyncStorage.multiRemove([
          'loginKey', 'agentId', 'bankId', 'userPhone', 'lastOtpId',
          'appConfig', ACCOUNT_DOWNLOAD_TIME_FLAG_KEY,
        ]);
        await DatabaseService.clearAllData();
      } catch (cleanupError) {
        // Keep the original API failure for the screen that made the request.
        console.log('401 session cleanup error:', cleanupError);
      } finally {
        sessionExpiredHandler?.();
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Every response from this API is wrapped as:
//   { statusCode, statusText, message, responseData }
// success = statusCode === 200 (matches CommonApiResponse.isSuccess() in Java)
// This helper unwraps that consistently for every call below.
// ============================================================================
const unwrap = (axiosResponse) => {
  // Some deployments return a JSON response with a text content-type. Axios
  // then leaves it as a string, while Android's Gson still parses it. Parse
  // it here so the iOS flow sees the same status and backend message.
  let body = axiosResponse.data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (error) {}
  }
  const responseData = body?.responseData ?? body?.ResponseData;
  const responseMessage = body?.message ?? body?.Message
    ?? body?.statusText ?? body?.StatusText
    ?? (typeof responseData === 'string' ? responseData : undefined);
  return {
    success: Number(body?.statusCode ?? body?.StatusCode) === 200,
    statusCode: body?.statusCode ?? body?.StatusCode,
    statusText: body?.statusText ?? body?.StatusText,
    message: responseMessage,
    data: responseData,
  };
};

const parsePayload = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

// AccountUpdateTimeFlag is a Java long. Capture its digits from the raw
// getaccounts JSON before JavaScript parses a value that may exceed the safe
// integer range. Android stores this timestamp with the downloaded list and
// posts the exact same value to Agent/startcollection.
const extractAccountUpdateTimeFlag = (rawBody) => {
  if (typeof rawBody !== 'string') return null;
  const match = rawBody.match(/\\?"AccountUpdateTimeFlag\\?"\s*:\s*\\?"?(\d+)/i);
  return match?.[1] || null;
};

const findNestedObject = (value, names, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 4) return null;
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const [key, child] of Object.entries(value)) {
    if (wanted.has(key.toLowerCase()) && child && typeof child === 'object') return child;
  }
  for (const child of Object.values(value)) {
    const found = findNestedObject(child, names, depth + 1);
    if (found) return found;
  }
  return null;
};

const normalizeAgent = (value) => {
  if (!value || typeof value !== 'object') return value;
  const aliases = {
    BankID: ['bankid'], BankName: ['bankname'], BankShortName: ['bankshortname'],
    BankAddress: ['bankaddress'], ContactNumber: ['contactnumber'],
    AgentID: ['agentid'], AgentDeviceId: ['agentdeviceid', 'agent_device_id'],
    AgentName: ['agentname'], MobileNumber: ['mobilenumber'],
    AgentImageLink: ['agentimagelink'], BankImageLink: ['bankimagelink'],
    TranBeginDate: ['tranbegindate', 'tran_begin_date'],
    CollectionStatus: ['collectionstatus'], SettledConfirmed: ['settledconfirmed'],
    SettledUnconfirmed: ['settledunconfirmed'],
    TitleBackColor: ['titlebackcolor'], TitleForeColor: ['titleforecolor'],
    BackColor: ['backcolor'], ForeColor: ['forecolor'],
    EnabledButtonBackColor: ['enabledbuttonbackcolor'],
    DisabledButtonForeColor: ['disabledbuttonforecolor'],
  };
  const normalized = { ...value };
  for (const [target, keys] of Object.entries(aliases)) {
    const sourceKey = Object.keys(value).find((key) => keys.includes(key.toLowerCase()));
    if (sourceKey !== undefined) normalized[target] = value[sourceKey];
  }
  return normalized;
};

const readField = (value, names) => {
  if (!value || typeof value !== 'object') return undefined;
  const wanted = new Set(names.map((name) => name.replace(/[_-]/g, '').toLowerCase()));
  const key = Object.keys(value).find((candidate) =>
    wanted.has(candidate.replace(/[_-]/g, '').toLowerCase())
  );
  return key === undefined ? undefined : value[key];
};

const parseOtpId = (value) => {
  // Treat the API response as a decimal identifier. This also works when the
  // native bridge presents the value as a string rather than a JS number.
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;

  const otpId = parseInt(text, 10);
  return otpId >= 1 && otpId <= 2147483647 ? otpId : null;
};

const getOtpId = (data, depth = 0, allowPrimitive = true) => {
  // Different deployed API versions return either the ID itself or an object
  // containing it. Keep this normalization at the service boundary so screens
  // never need to know the response serialization details.
  if (data === null || data === undefined || depth > 4) return null;
  if (typeof data === 'number') return allowPrimitive ? parseOtpId(data) : null;
  if (typeof data === 'string') {
    if (!allowPrimitive) return null;
    const directId = parseOtpId(data);
    if (directId !== null) return directId;
    try {
      return getOtpId(JSON.parse(data), depth + 1);
    } catch (e) {
      return null;
    }
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const id = getOtpId(item, depth + 1, true);
      if (id !== null) return id;
    }
    return null;
  }

  const idKeys = [
    'id', 'Id', 'otpId', 'OtpId', 'OTPId', 'otp_id',
    'requestOtpId', 'otpRequestId', 'OtpRequestId', 'requestId', 'RequestId',
    'otpSessionId', 'OtpSessionId',
  ];
  for (const key of idKeys) {
    const id = parseOtpId(data[key]);
    if (id !== null) return id;
  }
  const normalizedIdKeys = new Set([
    'id', 'otpid', 'requestotpid', 'otprequestid', 'requestid', 'otpsessionid',
  ]);
  for (const key of Object.keys(data)) {
    if (normalizedIdKeys.has(key.replace(/[_-]/g, '').toLowerCase())) {
      const id = parseOtpId(data[key]);
      if (id !== null) return id;
    }
  }

  for (const value of Object.values(data)) {
    const id = getOtpId(value, depth + 1, false);
    if (id !== null) return id;
  }
  return null;
};

const ApiService = {
  // App.js registers this once so the globally handled 401 can return to the
  // same entry flow Android reaches after restarting MainActivity.
  setSessionExpiredHandler: (handler) => {
    sessionExpiredHandler = handler;
  },

  // --------------------------------------------------------------------
  // POST App/appconfig — no request body
  // --------------------------------------------------------------------
  getAppConfig: async () => {
    try {
      const response = await apiClient.post('App/appconfig');
      // App/appconfig is the one Android endpoint that does not use the
      // CommonApiResponse wrapper.
      const body = response.data;
      const isWrapped = body?.statusCode !== undefined || body?.StatusCode !== undefined;
      return isWrapped ? unwrap(response) : { success: true, data: body };
    } catch (error) {
      throw ApiService._handleError(error);
    }
  },

  // --------------------------------------------------------------------
  // POST Device/register — body: { number, name }  (RegsiterDeviceRequest.java)
  // --------------------------------------------------------------------
  registerDevice: async (number, name) => {
    try {
      const response = await apiClient.post('Device/register', { number, name });
      const result = unwrap(response);
      const payload = parsePayload(result.data);
      const deviceId = Number(readField(payload, ['DeviceId', 'Id', 'device_id']) ?? payload) || 0;
      return { ...result, data: payload, deviceId };
    } catch (error) {
      throw ApiService._handleError(error);
    }
  },

  // --------------------------------------------------------------------
  // POST Auth/getotp — body: { phoneNumber, appHashKey }  (OtpRequest.java)
  // responseData may be the ID itself or an object containing it, depending on
  // the deployed API version. otpId normalizes that value for callers.
  // --------------------------------------------------------------------
  sendOtp: async (phoneNumber, appHashKey = '') => {
    try {
      // Do not leave a previous OTP's ID available if this request fails or
      // returns an unexpected payload.
      await AsyncStorage.removeItem('lastOtpId');

      const response = await apiClient.post('Auth/getotp', {
        phoneNumber: phoneNumber.trim(),
        appHashKey,
      });
      const result = unwrap(response);
      // Some deployments put responseData under another envelope key, so use
      // the full response as a fallback when the normal unwrapped value is
      // absent or has a different shape.
      const otpId = getOtpId(result.data) || getOtpId(response.data);

      if (result.success && otpId !== null) {
        await AsyncStorage.setItem('lastOtpId', String(otpId));
      }
      return { ...result, otpId };
    } catch (error) {
      throw ApiService._handleError(error);
    }
  },

  // --------------------------------------------------------------------
  // POST Auth/verifyotp — body matches VerifyOtpReq.java exactly:
  //   { deviceId, otpId, otp, phoneNumber, appVersionId, latitude,
  //     longitude, locationName, pinCode, firebaseId }
  // responseData -> { LoginKey, AppConfigDetails, AgentId, BankId }
  //   (VerifyOtpResponse.java)
  // --------------------------------------------------------------------
  verifyOtp: async (phoneNumber, otp, location = {}, requestOtpId = null) => {
    try {
      // Prefer the ID from the active OTP screen. AsyncStorage remains a
      // fallback for callers that do not have the original getotp response.
      const storedOtpId =
        requestOtpId ?? (await AsyncStorage.getItem('lastOtpId'));
      const otpId = parseOtpId(storedOtpId);
      console.log('OTP ID parsed for verifyotp:', { requestOtpId, storedOtpId, otpId });

      if (otpId === null) {
        throw new Error('Your OTP session is missing or has expired. Please request a new OTP.');
      }

      const deviceId = parseInt((await AsyncStorage.getItem('deviceId')) || '0', 10);

      const response = await apiClient.post('Auth/verifyotp', {
        deviceId,
        otpId,
        otp: otp.trim(),
        phoneNumber: phoneNumber.trim(),
        appVersionId: APP_VERSION_CODE,
        latitude: location.latitude || 0,
        longitude: location.longitude || 0,
        locationName: location.locationName || '',
        pinCode: location.pinCode || '',
        firebaseId: '', // populate once push notifications are wired up
      });

      const result = unwrap(response);
      console.log('Verify response envelope:', {
        success: result.success,
        statusCode: result.statusCode,
        dataType: typeof result.data,
        dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
        message: result.message,
      });

      if (result.success && result.data) {
        // Android gets a fresh process after its restart; reset the equivalent
        // iOS one-time guard once a new OTP login succeeds.
        isSessionExpired = false;
        const verifyData = parsePayload(result.data);
        const verifyResponse = findNestedObject(
          verifyData,
          ['VerifyOtpResponse', 'verifyOtpResponse', 'Result']
        ) || verifyData;
        const loginKey = readField(verifyResponse, ['LoginKey', 'loginKey', 'login_key']);
        const agentId = readField(verifyResponse, ['AgentId', 'agentId', 'agent_id']);
        const bankId = readField(verifyResponse, ['BankId', 'bankId', 'bank_id']);
        await AsyncStorage.setItem('loginKey', loginKey || '');
        await AsyncStorage.setItem('agentId', String(agentId || ''));
        await AsyncStorage.setItem('bankId', String(bankId || ''));
        const appConfig = readField(verifyResponse, ['AppConfigDetails', 'appConfigDetails']);
        if (appConfig) await AsyncStorage.setItem('appConfig', JSON.stringify(appConfig));
        console.log('Auth session saved:', {
          loginKey: Boolean(loginKey),
          agentId: agentId || 0,
          bankId: bankId || 0,
        });
      }

      return result;
    } catch (error) {
      console.log('Verify OTP ERROR:', JSON.stringify(error.response?.data || error.message));
      throw ApiService._handleError(error);
    }
  },

  // --------------------------------------------------------------------
  // POST Agent/getloggedagentdetail — no body, uses auth headers
  // --------------------------------------------------------------------
  getAgentInfo: async () => {
    try {
      const response = await apiClient.post('Agent/getloggedagentdetail');
      const result = unwrap(response);
      const agentResponse = parsePayload(result.data);
      const agent = normalizeAgent(
        findNestedObject(agentResponse, ['Agent', 'AgentDetails', 'User']) || agentResponse
      );
      const validation = findNestedObject(agentResponse, ['Validation']);
      const appConfig = findNestedObject(agentResponse, ['AppConfigDetails', 'AppConfig']);
      console.log('Agent details response:', {
        success: result.success,
        statusCode: result.statusCode,
        keys: agentResponse && typeof agentResponse === 'object' ? Object.keys(agentResponse) : [],
        agentKeys: agent && typeof agent === 'object' ? Object.keys(agent) : [],
        hasBankImage: Boolean(readField(agent, ['BankImageLink', 'bankImageLink'])),
        hasAgentImage: Boolean(readField(agent, ['AgentImageLink', 'agentImageLink'])),
      });
      if (result.success && agent) {
        await DatabaseService.insertUser(agent);
        // Android's getloggedagentdetail flow updates an existing validation
        // record but never replaces the validation received from getaccounts.
        // Replacing it here loses the downloaded-list time flag and makes
        // Agent/startcollection reject the request as "latest list not
        // downloaded". The account-download response owns this local record.
        if (appConfig) await AsyncStorage.setItem('appConfig', JSON.stringify(appConfig));
      }
      return { ...result, data: agent, validation, appConfig };
    } catch (error) {
      // Android queues a profile refresh when a cached user exists but the
      // network is unavailable. Keep a single pending refresh for the same
      // behavior on iOS/React Native.
      try {
        const cachedUser = await DatabaseService.getUser();
        const pending = await DatabaseService.getApiQueue('pending');
        if (cachedUser && !pending.some((item) => item.Endpoint === 'Agent/getloggedagentdetail')) {
          await ApiService.addToSyncQueue('Agent/getloggedagentdetail', 'POST', {});
        }
      } catch (queueError) {}
      throw ApiService._handleError(error);
    }
  },

  // --------------------------------------------------------------------
  // POST Agent/getaccounts — no body, uses auth headers
  // --------------------------------------------------------------------
  getAccounts: async () => {
    try {
      // Keep this one response raw long enough to preserve the exact Java
      // long AccountUpdateTimeFlag. unwrap() parses the envelope afterwards.
      const response = await apiClient.post('Agent/getaccounts', undefined, {
        transformResponse: [(body) => body],
      });
      const exactDownloadTimeFlag = extractAccountUpdateTimeFlag(response.data);
      const result = unwrap(response);
      const accountResponse = parsePayload(result.data);
      const accounts = Array.isArray(accountResponse)
        ? accountResponse
        : accountResponse?.Accounts ?? accountResponse?.accounts ?? [];
      const validation = Array.isArray(accountResponse)
        ? null
        : accountResponse?.Validation ?? accountResponse?.validation ?? null;

      if (result.success && Array.isArray(accounts)) {
        await DatabaseService.deleteAllAccounts();
        for (const account of accounts) {
          await DatabaseService.insertAccount(account);
        }
        if (validation) await DatabaseService.insertValidation(validation);
        const parsedFlag = readField(validation, ['AccountUpdateTimeFlag', 'accountUpdateTimeFlag']);
        const downloadTimeFlag = exactDownloadTimeFlag || (parsedFlag === undefined || parsedFlag === null ? null : String(parsedFlag));
        if (downloadTimeFlag) await AsyncStorage.setItem(ACCOUNT_DOWNLOAD_TIME_FLAG_KEY, downloadTimeFlag);
      }

      return { ...result, data: accounts, validation, accountDownloadTimeFlag: exactDownloadTimeFlag };
    } catch (error) {
      throw ApiService._handleError(error);
    }
  },

  // --------------------------------------------------------------------
  // POST Agent/startcollection — raw numeric time flag with application/json.
  // Android uses RequestBody.create(MediaType.parse("application/json"),
  // String.valueOf(timeFlag)); it is not text/plain and not a JSON object.
  // --------------------------------------------------------------------
  startCollection: async (timeFlag) => {
    try {
      console.log('startcollection request', {
        contentType: 'application/json',
        rawTimeFlag: String(timeFlag),
        rawTimeFlagLength: String(timeFlag).length,
      });
      const response = await apiClient.post('Agent/startcollection', String(timeFlag), {
        headers: { 'Content-Type': 'application/json' },
        // Axios normally JSON-stringifies a JS string, producing
        // "20260826125352640". Android's RequestBody sends 20260826125352640
        // without quotes, so preserve the raw numeric text.
        transformRequest: [(data) => data],
      });
      const result = unwrap(response);
      console.log('startcollection response', {
        httpStatus: response.status,
        success: result.success,
        statusCode: result.statusCode,
        message: result.message,
        data: result.data,
      });
      return { ...result, data: parsePayload(result.data) };
    } catch (error) {
      console.log('startcollection error', {
        httpStatus: error.response?.status,
        responseBody: error.response?.data,
        message: error.message,
      });
      throw ApiService._handleError(error);
    }
  },

  getDownloadedAccountsTimeFlag: async () => AsyncStorage.getItem(ACCOUNT_DOWNLOAD_TIME_FLAG_KEY),

  // --------------------------------------------------------------------
  // POST Agent/updatetransaction — body: Transaction object
  // Field names must match src/database/schemas.js Transaction fields
  // --------------------------------------------------------------------
  updateTransaction: async (transaction) => {
    try {
      const response = await apiClient.post('Agent/updatetransaction', transaction);
      const result = unwrap(response);
      if (result.success) {
        await DatabaseService.insertTransaction({
          ...transaction,
          syncStatus: 1,
          SyncStatus: 1,
          tranRemarks: '',
          TranRemarks: '',
        });
      }
      return result;
    } catch (error) {
      throw ApiService._handleError(error);
    }
  },

  // Android persists every collection locally and adds it to its ApiSyncWorker
  // queue before attempting the upload. This prevents a collection from being
  // lost when the connection drops during Agent/updatetransaction.
  queueTransactionUpload: async (transaction) => {
    await DatabaseService.insertTransaction({
      ...transaction,
      TransactionDate: transaction.TransactionDate || transaction.tranDate || new Date().toISOString(),
      ReceiptNumber: transaction.ReceiptNumber || transaction.tranNumber,
      syncStatus: 0,
      SyncStatus: 0,
      tranRemarks: '',
      TranRemarks: '',
    });
    await ApiService.addToSyncQueue('Agent/updatetransaction', 'POST', transaction);
  },

  // --------------------------------------------------------------------
  // POST Agent/submitcollection — no body, uses auth headers
  // --------------------------------------------------------------------
  submitCollection: async () => {
    try {
      const response = await apiClient.post('Agent/submitcollection');
      const result = unwrap(response);
      return { ...result, data: parsePayload(result.data) };
    } catch (error) {
      throw ApiService._handleError(error);
    }
  },

  // --------------------------------------------------------------------
  // POST Agent/updatemobilenumber — body: { ... } (AddPhoneNumberRequest.java
  // fields weren't in the excerpt reviewed — verify field names against your
  // backend/Postman collection before relying on this in production)
  // --------------------------------------------------------------------
  updatePhoneNumber: async (payload) => {
    try {
      const response = await apiClient.post('Agent/updatemobilenumber', payload);
      return unwrap(response);
    } catch (error) {
      throw ApiService._handleError(error);
    }
  },

  // --------------------------------------------------------------------
  // Offline queue management — unchanged, generic mechanism
  // --------------------------------------------------------------------
  addToSyncQueue: async (endpoint, method, params) => {
    try {
      await DatabaseService.insertApiQueue({
        Endpoint: endpoint,
        Method: method,
        // DatabaseService serializes the object. Do not stringify here or the
        // worker would post a JSON string instead of the transaction object.
        Params: params,
        Status: 'pending',
      });
    } catch (error) {
      console.log('Error adding to sync queue:', error);
    }
  },

  syncOfflineQueue: async () => {
    const outcome = { online: false, attempted: 0, uploaded: 0, remaining: 0, errors: [] };
    try {
      // Repair any legacy/local transaction that is unsynced but did not get a
      // queue row. This makes syncStatus the authoritative Android-equivalent
      // gate for submit, while still giving the transaction a retry path.
      await DatabaseService.migrateLegacyTransactionSyncStates();
      const [unsyncedTransactions, existingQueue] = await Promise.all([
        DatabaseService.getUnsyncedTransactions(),
        DatabaseService.getApiQueue('pending'),
      ]);
      const queuedTransactionIds = new Set(existingQueue
        .filter((item) => item.Endpoint === 'Agent/updatetransaction'
          || item.Endpoint === '/transactions/collection'
          || item.Endpoint === 'transactions/collection')
        .map((item) => {
          try {
            let payload = item.Params;
            while (typeof payload === 'string') payload = JSON.parse(payload);
            return payload.TransactionId || payload.transactionId;
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean));
      for (const transaction of unsyncedTransactions) {
        const transactionId = transaction.TransactionId || transaction.transactionId;
        if (transactionId && !queuedTransactionIds.has(transactionId)) {
          await ApiService.addToSyncQueue('Agent/updatetransaction', 'POST', transaction);
        }
      }

      const queueItems = await DatabaseService.getApiQueue('pending');
      // Do not use App/appconfig as a network gate. Android checks device
      // connectivity and then posts each queued transaction directly; a
      // healthy API can reject/shape appconfig differently from transaction
      // endpoints. The upload response itself is the reliable sync result.
      outcome.online = true;
      for (const item of queueItems) {
        outcome.attempted += 1;
        try {
          let params = item.Params;
          // Read legacy rows created before the double-encoding fix too.
          while (typeof params === 'string') {
            const parsed = JSON.parse(params);
            if (parsed === params) break;
            params = parsed;
          }
          const endpoint = item.Endpoint === '/transactions/collection' || item.Endpoint === 'transactions/collection'
            ? 'Agent/updatetransaction'
            : String(item.Endpoint || '').replace(/^\/+/, '');
          const response = await apiClient.post(endpoint, params);
          const result = unwrap(response);
          if (result.success) {
            if (endpoint === 'Agent/getloggedagentdetail') {
              const agentResponse = parsePayload(result.data);
              const agent = normalizeAgent(
                findNestedObject(agentResponse, ['Agent', 'AgentDetails', 'User']) || agentResponse
              );
              if (agent) await DatabaseService.insertUser(agent);
            }
            if (endpoint === 'Agent/updatetransaction') {
              const transactionId = params.TransactionId || params.transactionId;
              if (transactionId) await DatabaseService.updateTransactionSyncState(transactionId, 1);
            }
            await DatabaseService.deleteApiQueueItem(item.QueueId);
            outcome.uploaded += 1;
          } else {
            // Keep it pending: Android's worker retries failed uploads.
            if (endpoint === 'Agent/updatetransaction') {
              const transactionId = params.TransactionId || params.transactionId;
              if (transactionId) await DatabaseService.updateTransactionSyncState(transactionId, 0, result.message || 'Upload failed');
            }
            outcome.errors.push(result.message || 'Upload failed');
          }
        } catch (error) {
          if (error.status === 0 || error.response === undefined) outcome.online = false;
          outcome.errors.push(error.message || 'Upload failed');
          try {
            let params = item.Params;
            while (typeof params === 'string') params = JSON.parse(params);
            const transactionId = params.TransactionId || params.transactionId;
            if (transactionId) await DatabaseService.updateTransactionSyncState(transactionId, 0, error.message || 'Upload failed');
          } catch (parseError) {}
        }
      }
      outcome.remaining = (await DatabaseService.getUnsyncedTransactions()).length;
    } catch (error) {
      console.log('Error syncing offline queue:', error);
      outcome.errors.push(error.message || 'Sync failed');
    }
    return outcome;
  },

  getPendingTransactionCount: async () => {
    // Exact Android equivalent: TransactionDao.getPendingTranCount() is
    // `SELECT COUNT(*) FROM transactions WHERE sync_status = 0`. Queue rows
    // are deliberately excluded so they can never inflate the displayed count.
    await DatabaseService.migrateLegacyTransactionSyncStates();
    return (await DatabaseService.getUnsyncedTransactions()).length;
  },

  // --------------------------------------------------------------------
  // Logout — no explicit Auth/logout endpoint exists in the real API,
  // so this just clears local session data (matches AuthInterceptor's
  // clearTokens() behavior on 401).
  // --------------------------------------------------------------------
  logout: async () => {
    await AsyncStorage.multiRemove(['loginKey', 'agentId', 'bankId', 'userPhone', 'lastOtpId', ACCOUNT_DOWNLOAD_TIME_FLAG_KEY]);
    await DatabaseService.clearUser();
  },

  // --------------------------------------------------------------------
  // Error handler
  // --------------------------------------------------------------------
  _handleError: (error) => {
    if (error.response) {
      const responseBody = error.response.data || {};
      // The deployed API uses both CommonApiResponse casing variants. Preserve
      // its message verbatim so screens never replace a useful server reason
      // (for example a validation or collection-state error) with a generic
      // client-side alert.
      const serverMessage = responseBody.message
        ?? responseBody.Message
        ?? responseBody.statusText
        ?? responseBody.StatusText
        ?? responseBody.responseData?.message
        ?? responseBody.ResponseData?.Message;
      return {
        status: error.response.status,
        message: serverMessage || `Request failed (${error.response.status})`,
        data: responseBody,
      };
    } else if (error.request) {
      return {
        status: 0,
        // Matches DefaultViewModel's NetworkUtils error for online-only calls.
        // Offline collections are kept by the sync queue and retried later.
        message: 'No internet connection. Check your connection and try again.',
      };
    }
    return {
      status: -1,
      message: error.message || 'An error occurred',
    };
  },

  // Basic reachability check — hits the appconfig endpoint since there's
  // no dedicated /health endpoint in the real API.
  testConnection: async () => {
    try {
      const response = await apiClient.post('App/appconfig', null, { timeout: 5000 });
      return response.data?.statusCode === 200;
    } catch (error) {
      return false;
    }
  },
};

export default ApiService;
