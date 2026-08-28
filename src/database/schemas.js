export const CREATE_USER_TABLE = `
  CREATE TABLE IF NOT EXISTS user (
    BankID INTEGER,
    BankName TEXT,
    BankShortName TEXT,
    BankAddress TEXT,
    ContactNumber TEXT,
    AgentImageLink TEXT,
    TitleBackColor INTEGER,
    TitleForeColor INTEGER,
    BackColor INTEGER,
    ForeColor INTEGER,
    EnabledButtonBackColor INTEGER,
    DisabledButtonForeColor INTEGER,
    LocationX REAL,
    LocationY REAL,
    PrintHeader1 TEXT,
    PrintHeader2 TEXT,
    PrintHeader3 TEXT,
    PrintHeader4 TEXT,
    PrintFooter1 TEXT,
    PrintFooter2 TEXT,
    PrintFooter3 TEXT,
    PrintFooter4 TEXT,
    PrintPoweredBy TEXT,
    AgentID INTEGER PRIMARY KEY,
    AgentDeviceId INTEGER,
    AgentName TEXT,
    MobileNumber TEXT,
    BankImageLink TEXT,
    Gender INTEGER,
    SettledConfirmed REAL,
    SettledUnconfirmed REAL,
    CollectionStatus INTEGER,
    PaymentModeAllowed INTEGER,
    UPIURI TEXT,
    WAURL TEXT,
    data TEXT
  );
`;

export const CREATE_ACCOUNTS_TABLE = `
  CREATE TABLE IF NOT EXISTS accounts (
    PositionIndex INTEGER,
    AccountId INTEGER PRIMARY KEY,
    AccountNumber TEXT,
    CustomerCode TEXT,
    AccountName TEXT,
    AccountAddress TEXT,
    MobileNumber TEXT,
    AgreedAmount REAL,
    OpeningDate TEXT,
    LastTranDate TEXT,
    BalanceAmount REAL,
    LeanAccountNumber TEXT,
    LeanAmount REAL,
    SchemeCode TEXT,
    SchemeName TEXT,
    SearchKey TEXT,
    collectionCount INTEGER DEFAULT 0,
    lastCollectedAmt REAL DEFAULT 0,
    lastReceipt INTEGER DEFAULT 0,
    LocationX REAL DEFAULT 0,
    LocationY REAL DEFAULT 0,
    data TEXT
  );
`;

export const CREATE_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    TransactionId TEXT PRIMARY KEY,
    AccountId INTEGER,
    Amount REAL,
    TransactionDate TEXT,
    ReceiptNumber TEXT,
    data TEXT,
    FOREIGN KEY (AccountId) REFERENCES accounts(AccountId)
  );
`;

export const CREATE_VALIDATION_TABLE = `
  CREATE TABLE IF NOT EXISTS validations (
    ValidationId TEXT PRIMARY KEY,
    AccountId INTEGER,
    ValidationType TEXT,
    ValidationStatus INTEGER,
    data TEXT,
    FOREIGN KEY (AccountId) REFERENCES accounts(AccountId)
  );
`;

export const CREATE_API_QUEUE_TABLE = `
  CREATE TABLE IF NOT EXISTS api_queue (
    QueueId TEXT PRIMARY KEY,
    Endpoint TEXT,
    Method TEXT,
    Params TEXT,
    Status TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT
  );
`;
