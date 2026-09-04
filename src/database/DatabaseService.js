import SQLite from 'react-native-sqlite-storage';
import {
  CREATE_USER_TABLE,
  CREATE_ACCOUNTS_TABLE,
  CREATE_TRANSACTIONS_TABLE,
  CREATE_VALIDATION_TABLE,
  CREATE_API_QUEUE_TABLE,
} from './schemas';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

let db = null;

const DatabaseService = {
  initDatabase: async () => {
    try {
      db = await SQLite.openDatabase({
        name: 'pygma.db',
        location: 'default',
      });

      console.log('Database opened successfully');

      // Create tables
      await db.executeSql(CREATE_USER_TABLE);
      await db.executeSql(CREATE_ACCOUNTS_TABLE);
      await db.executeSql(CREATE_TRANSACTIONS_TABLE);
      await db.executeSql(CREATE_VALIDATION_TABLE);
      await db.executeSql(CREATE_API_QUEUE_TABLE);

      // CREATE TABLE IF NOT EXISTS does not add newly introduced columns to
      // databases already installed on a device.
      const userTableInfo = await db.executeSql('PRAGMA table_info(user)');
      const userColumns = new Set();
      for (let i = 0; i < userTableInfo[0].rows.length; i++) {
        userColumns.add(userTableInfo[0].rows.item(i).name);
      }
      if (!userColumns.has('TranBeginDate')) {
        await db.executeSql('ALTER TABLE user ADD COLUMN TranBeginDate TEXT');
      }

      console.log('All tables created successfully');
      return db;
    } catch (error) {
      console.log('Error initializing database:', error);
      throw error;
    }
  },

  getDatabase: () => db,

  // User operations
  insertUser: async (user) => {
    try {
      const {
        BankID,
        BankName,
        BankShortName,
        AgentID,
        AgentDeviceId,
        AgentName,
        MobileNumber,
        AgentImageLink,
        BankImageLink,
        TranBeginDate,
        ...rest
      } = user;

      await db.executeSql(
        `INSERT OR REPLACE INTO user (
          BankID, BankName, BankShortName, AgentID, AgentDeviceId, AgentName,
          MobileNumber, AgentImageLink, BankImageLink, TranBeginDate, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          BankID || null,
          BankName || null,
          BankShortName || null,
          AgentID || null,
          AgentDeviceId || null,
          AgentName || null,
          MobileNumber || null,
          AgentImageLink || null,
          BankImageLink || null,
          TranBeginDate || null,
          JSON.stringify(rest),
        ]
      );
    } catch (error) {
      console.log('Error inserting user:', error);
      throw error;
    }
  },

  getUser: async () => {
    try {
      const result = await db.executeSql('SELECT * FROM user LIMIT 1');
      if (result[0].rows.length > 0) {
        const row = result[0].rows.item(0);
        const storedData = JSON.parse(row.data || '{}');
        return {
          ...row,
          ...storedData,
          // Prefer the dedicated agent-table column, while still supporting
          // installations where the value only exists in the legacy JSON.
          TranBeginDate: row.TranBeginDate
            || storedData.TranBeginDate
            || storedData.tranBeginDate
            || storedData.tranbegindate
            || null,
        };
      }
      return null;
    } catch (error) {
      console.log('Error getting user:', error);
      return null;
    }
  },

  clearUser: async () => {
    try {
      await db.executeSql('DELETE FROM user');
    } catch (error) {
      console.log('Error clearing user:', error);
    }
  },

  // Android AuthInterceptor calls AppDatabase.clearAllTables() after a 401.
  // Keep the same scope here so a session-expired user can never see or
  // upload accounts/receipts belonging to the old session.
  clearAllData: async () => {
    if (!db) return;
    try {
      // Use the promise database calls directly; react-native-sqlite-storage
      // guarantees each finishes before the next, and this also works on its
      // older iOS bridge implementation.
      await db.executeSql('DELETE FROM api_queue');
      await db.executeSql('DELETE FROM transactions');
      await db.executeSql('DELETE FROM validations');
      await db.executeSql('DELETE FROM accounts');
      await db.executeSql('DELETE FROM user');
    } catch (error) {
      console.log('Error clearing local database after session expiry:', error);
      throw error;
    }
  },

  // Account operations
  insertAccount: async (account) => {
    try {
      await db.executeSql(
        `INSERT OR REPLACE INTO accounts (
          PositionIndex, AccountId, AccountNumber, CustomerCode, AccountName,
          AccountAddress, MobileNumber, AgreedAmount, OpeningDate, LastTranDate,
          BalanceAmount, LeanAccountNumber, LeanAmount, SchemeCode, SchemeName,
          SearchKey, collectionCount, LocationX, LocationY, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.PositionIndex ?? account.positionIndex ?? null,
          account.AccountId,
          account.AccountNumber || null,
          account.CustomerCode || null,
          account.AccountName || null,
          account.AccountAddress || null,
          account.MobileNumber || null,
          account.AgreedAmount ?? 0,
          account.OpeningDate || null,
          account.LastTranDate || null,
          account.BalanceAmount ?? 0,
          account.LeanAccountNumber ?? account.leanAccountNumber ?? null,
          account.LeanAmount ?? account.leanAmount ?? 0,
          account.SchemeCode ?? account.schemeCode ?? null,
          account.SchemeName ?? account.schemeName ?? null,
          account.SearchKey || null,
          account.CollectionCount ?? account.collectionCount ?? 0,
          account.locationX ?? account.LocationX ?? account.latitude ?? account.Latitude ?? 0,
          account.locationY ?? account.LocationY ?? account.longitude ?? account.Longitude ?? 0,
          JSON.stringify(account),
        ]
      );
    } catch (error) {
      console.log('Error inserting account:', error);
      throw error;
    }
  },

  getAccounts: async () => {
    try {
      const result = await db.executeSql(
        'SELECT * FROM accounts ORDER BY CASE WHEN PositionIndex IS NULL THEN 1 ELSE 0 END, PositionIndex, AccountName'
      );
      const accounts = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        const rawAccount = JSON.parse(row.data || '{}');
        // Older app versions only populated a subset of the SQL columns. Do
        // not let their null columns hide complete values retained in `data`.
        const account = { ...rawAccount, ...row };
        [
          'PositionIndex', 'AccountNumber', 'CustomerCode', 'AccountName',
          'AccountAddress', 'AgreedAmount', 'OpeningDate', 'LastTranDate',
          'BalanceAmount', 'LeanAccountNumber', 'LeanAmount', 'SchemeCode',
          'SchemeName', 'SearchKey',
        ].forEach((field) => {
          // These values belong to the downloaded API snapshot. In particular,
          // collecting locally must not change BalanceAmount/LastTranDate.
          if (rawAccount[field] !== null && rawAccount[field] !== undefined) {
            account[field] = rawAccount[field];
          }
        });
        // MobileNumber is deliberately SQL-first because the user can edit it
        // locally through Agent/updatemobilenumber.
        account.MobileNumber = row.MobileNumber ?? rawAccount.MobileNumber;
        account.collectionCount = Math.max(
          Number(row.collectionCount) || 0,
          Number(rawAccount.CollectionCount ?? rawAccount.collectionCount) || 0
        );
        const latitude = [
          rawAccount.locationX,
          rawAccount.LocationX,
          rawAccount.latitude,
          rawAccount.Latitude,
          rawAccount.LocationLatitude,
          row.LocationX,
        ].map((value) => Number(value)).find((value) => Number.isFinite(value) && value !== 0);
        const longitude = [
          rawAccount.locationY,
          rawAccount.LocationY,
          rawAccount.longitude,
          rawAccount.Longitude,
          rawAccount.LocationLongitude,
          row.LocationY,
        ].map((value) => Number(value)).find((value) => Number.isFinite(value) && value !== 0);
        if (latitude !== undefined) account.LocationX = latitude;
        if (longitude !== undefined) account.LocationY = longitude;
        accounts.push(account);
      }
      return accounts;
    } catch (error) {
      console.log('Error getting accounts:', error);
      return [];
    }
  },

  markAccountCollected: async (accountId, amount, receiptNumber) => {
    try {
      await db.executeSql(
        `UPDATE accounts SET collectionCount = COALESCE(collectionCount, 0) + 1, lastCollectedAmt = COALESCE(lastCollectedAmt, 0) + ?, lastReceipt = ? WHERE AccountId = ?`,
        [amount || 0, receiptNumber || 0, accountId]
      );
    } catch (error) {
      console.log('Error updating collected account:', error);
    }
  },

  updateAccountMobileNumber: async (accountId, mobileNumber) => {
    try {
      await db.executeSql(
        'UPDATE accounts SET MobileNumber = ? WHERE AccountId = ?',
        [mobileNumber, accountId]
      );
    } catch (error) {
      console.log('Error updating account mobile number:', error);
    }
  },

  getAccount: async (accountId) => {
    try {
      const result = await db.executeSql(
        'SELECT * FROM accounts WHERE AccountId = ?',
        [accountId]
      );
      if (result[0].rows.length > 0) {
        const row = result[0].rows.item(0);
        return {
          ...row,
          ...JSON.parse(row.data || '{}'),
        };
      }
      return null;
    } catch (error) {
      console.log('Error getting account:', error);
      return null;
    }
  },

  deleteAllAccounts: async () => {
    try {
      await db.executeSql('DELETE FROM accounts');
    } catch (error) {
      console.log('Error deleting accounts:', error);
    }
  },

  // Transaction operations
  insertTransaction: async (transaction) => {
    try {
      await db.executeSql(
        `INSERT INTO transactions (
          TransactionId, AccountId, Amount, TransactionDate, ReceiptNumber, data
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          transaction.TransactionId || Math.random().toString(),
          transaction.AccountId,
          transaction.Amount || 0,
          transaction.TransactionDate || new Date().toISOString(),
          transaction.ReceiptNumber || null,
          JSON.stringify(transaction),
        ]
      );
    } catch (error) {
      console.log('Error inserting transaction:', error);
      throw error;
    }
  },

  getTransactions: async (accountId = null) => {
    try {
      let query = 'SELECT * FROM transactions';
      let params = [];
      if (accountId) {
        query += ' WHERE AccountId = ?';
        params = [accountId];
      }
      query += ' ORDER BY TransactionDate DESC';

      const result = await db.executeSql(query, params);
      const transactions = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        transactions.push({
          ...row,
          ...JSON.parse(row.data || '{}'),
        });
      }
      return transactions;
    } catch (error) {
      console.log('Error getting transactions:', error);
      return [];
    }
  },

  // Android's DashboardViewModel uses TransactionDao.getPendingTranCount()
  // (syncStatus = 0) to decide whether Submit is allowed. The queue is only
  // the delivery mechanism; this record state is the source of truth.
  getUnsyncedTransactions: async () => {
    const transactions = await DatabaseService.getTransactions();
    return transactions.filter((transaction) =>
      Number(transaction.syncStatus ?? transaction.SyncStatus) === 0
    );
  },

  migrateLegacyTransactionSyncStates: async () => {
    try {
      const [transactions, queue] = await Promise.all([
        DatabaseService.getTransactions(),
        DatabaseService.getApiQueue('pending'),
      ]);
      const queuedTransactionIds = new Set(queue
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

      for (const transaction of transactions) {
        const status = transaction.syncStatus ?? transaction.SyncStatus;
        if (status !== undefined && status !== null) continue;
        const transactionId = transaction.TransactionId || transaction.transactionId;
        // A legacy queue row means this transaction still needs upload. A
        // status-less record with no queue came from a prior server response or
        // an old direct-success flow, so it must not block Submit forever.
        await DatabaseService.updateTransactionSyncState(
          transactionId,
          queuedTransactionIds.has(transactionId) ? 0 : 1
        );
      }
    } catch (error) {
      console.log('Error migrating legacy transaction sync states:', error);
    }
  },

  getNextTransactionNumbers: async (validation = null) => {
    const transactions = await DatabaseService.getTransactions();
    const now = new Date();
    // The Android app uses the server-issued transaction sequence.  Earlier
    // iOS builds used Date.now() as a receipt number, which leaves a 13-digit
    // value in the local database.  That is not a valid server sequence and
    // makes every later upload fail validation as well.
    const isValidSequenceNumber = (value) => Number.isSafeInteger(value)
      && value > 0
      && value <= 2147483647;
    const isSameDay = (left, right) => left && right
      && left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
    const transactionNumbers = transactions
      .map((transaction) => Number(transaction.tranNumber ?? transaction.TranNumber))
      .filter(isValidSequenceNumber);
    const localLastNumber = transactionNumbers.length ? Math.max(...transactionNumbers) : 0;
    const validationLastNumber = Number(validation?.LastTranNumber ?? validation?.lastTranNumber) || 0;
    const lastTransactionNumber = Math.max(localLastNumber, validationLastNumber);

    if (!lastTransactionNumber) {
      const validationDate = new Date(validation?.LastDate ?? validation?.lastDate);
      const validationDailyNumber = Number(validation?.LastDatewiseTranNumber ?? validation?.lastDatewiseTranNumber) || 0;
      return {
        tranNumber: validationLastNumber + 1,
        datewiseTranNumber: isSameDay(now, validationDate) ? validationDailyNumber + 1 : 1,
      };
    }

    const dailyNumbers = transactions
      .filter((transaction) => isSameDay(new Date(transaction.tranDate ?? transaction.TransactionDate), now))
      .map((transaction) => Number(transaction.datewiseTranNumber ?? transaction.DatewiseTranNumber))
      .filter(isValidSequenceNumber);
    const validationDate = new Date(validation?.LastDate ?? validation?.lastDate);
    const validationDailyNumber = Number(validation?.LastDatewiseTranNumber ?? validation?.lastDatewiseTranNumber) || 0;
    const localDailyNumber = dailyNumbers.length ? Math.max(...dailyNumbers) : 0;
    return {
      tranNumber: lastTransactionNumber + 1,
      datewiseTranNumber: isSameDay(now, validationDate)
        ? Math.max(localDailyNumber, validationDailyNumber) + 1
        : localDailyNumber + 1,
    };
  },

  deleteAllTransactions: async () => {
    try {
      await db.executeSql('DELETE FROM transactions');
    } catch (error) {
      console.log('Error deleting transactions:', error);
    }
  },

  deleteTransaction: async (transactionId) => {
    try {
      await db.executeSql('DELETE FROM transactions WHERE TransactionId = ?', [
        transactionId,
      ]);
    } catch (error) {
      console.log('Error deleting transaction:', error);
    }
  },

  updateTransactionSyncState: async (transactionId, syncStatus, tranRemarks = '') => {
    try {
      const result = await db.executeSql(
        'SELECT data FROM transactions WHERE TransactionId = ? LIMIT 1',
        [transactionId]
      );
      if (!result[0].rows.length) return;
      const stored = JSON.parse(result[0].rows.item(0).data || '{}');
      await db.executeSql(
        'UPDATE transactions SET data = ? WHERE TransactionId = ?',
        [JSON.stringify({ ...stored, syncStatus, SyncStatus: syncStatus, tranRemarks, TranRemarks: tranRemarks }), transactionId]
      );
    } catch (error) {
      console.log('Error updating transaction sync state:', error);
    }
  },

  // Validation operations
  insertValidation: async (validation) => {
    try {
      // Android stores one validation record returned alongside the downloaded
      // accounts. Keep a stable key so a later download replaces it.
      const validationId = validation.id ?? validation.Id ?? validation.ValidationId ?? 'current';
      await db.executeSql(
        `INSERT OR REPLACE INTO validations (
          ValidationId, AccountId, ValidationType, ValidationStatus, data
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          validationId,
          validation.AccountId,
          validation.ValidationType || null,
          validation.ValidationStatus || 0,
          JSON.stringify(validation),
        ]
      );
    } catch (error) {
      console.log('Error inserting validation:', error);
      throw error;
    }
  },

  getValidations: async (accountId = null) => {
    try {
      let query = 'SELECT * FROM validations';
      let params = [];
      if (accountId) {
        query += ' WHERE AccountId = ?';
        params = [accountId];
      }

      const result = await db.executeSql(query, params);
      const validations = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const row = result[0].rows.item(i);
        validations.push({
          ...row,
          ...JSON.parse(row.data || '{}'),
        });
      }
      return validations;
    } catch (error) {
      console.log('Error getting validations:', error);
      return [];
    }
  },

  getLatestValidation: async () => {
    try {
      const result = await db.executeSql('SELECT * FROM validations ORDER BY rowid DESC LIMIT 1');
      if (!result[0].rows.length) return null;
      const row = result[0].rows.item(0);
      return { ...row, ...JSON.parse(row.data || '{}') };
    } catch (error) {
      console.log('Error getting latest validation:', error);
      return null;
    }
  },

  // Mirrors ValidationDao.updateValidation(timeFlag) plus
  // updateLastTranDetails(...) after Android's successful startcollection.
  updateValidationAfterStart: async (timeFlag, startResponse = {}) => {
    const current = await DatabaseService.getLatestValidation();
    if (!current) return;
    await DatabaseService.insertValidation({
      ...current,
      LastRefreshTimeFlag: timeFlag,
      lastRefreshTimeFlag: timeFlag,
      LastTranNumber: startResponse.LastTranNumber ?? startResponse.lastTranNumber ?? current.LastTranNumber,
      LastDatewiseTranNumber: startResponse.LastDatewiseTranNumber ?? startResponse.lastDatewiseTranNumber ?? current.LastDatewiseTranNumber,
      LastDate: startResponse.LastDate ?? startResponse.lastDate ?? current.LastDate,
      TranBeginDate: startResponse.TranBeginDate ?? startResponse.tranBeginDate ?? startResponse.tranbegindate
        ?? current.TranBeginDate ?? current.tranBeginDate ?? current.tranbegindate,
    });
  },

  // API Queue operations
  insertApiQueue: async (queueItem) => {
    try {
      await db.executeSql(
        `INSERT INTO api_queue (
          QueueId, Endpoint, Method, Params, Status, CreatedAt
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          queueItem.QueueId || Math.random().toString(),
          queueItem.Endpoint,
          queueItem.Method || 'POST',
          JSON.stringify(queueItem.Params),
          queueItem.Status || 'pending',
          new Date().toISOString(),
        ]
      );
    } catch (error) {
      console.log('Error inserting API queue:', error);
      throw error;
    }
  },

  getApiQueue: async (status = 'pending') => {
    try {
      const result = await db.executeSql(
        'SELECT * FROM api_queue WHERE Status = ? ORDER BY CreatedAt ASC',
        [status]
      );
      const queue = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        queue.push(result[0].rows.item(i));
      }
      return queue;
    } catch (error) {
      console.log('Error getting API queue:', error);
      return [];
    }
  },

  updateApiQueueStatus: async (queueId, status) => {
    try {
      await db.executeSql(
        'UPDATE api_queue SET Status = ? WHERE QueueId = ?',
        [status, queueId]
      );
    } catch (error) {
      console.log('Error updating API queue status:', error);
    }
  },

  deleteApiQueueItem: async (queueId) => {
    try {
      await db.executeSql('DELETE FROM api_queue WHERE QueueId = ?', [queueId]);
    } catch (error) {
      console.log('Error deleting API queue item:', error);
    }
  },

  // Close database
  closeDatabase: async () => {
    try {
      if (db) {
        await db.close();
        db = null;
      }
    } catch (error) {
      console.log('Error closing database:', error);
    }
  },
};

export default DatabaseService;
