import AsyncStorage from '@react-native-async-storage/async-storage';
import BluetoothService from './BluetoothService';

const PRINTER_ADDRESS_KEY = 'receiptPrinterAddress';
const LINE_WIDTH = 32;

const valueOrEmpty = (value) => String(value ?? '').trim();

const receiptLine = (label, value) => {
  const text = valueOrEmpty(value);
  const padding = Math.max(LINE_WIDTH - label.length - text.length, 1);
  return `${label}${' '.repeat(padding)}${text}\n`;
};

const formatAmount = (value) => Number(value || 0).toFixed(2);

const padDatePart = (value) => String(value).padStart(2, '0');

const formatDateOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return valueOrEmpty(value).split(/[T\s]/)[0];
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};

const formatReceiptDateTime = (date = new Date()) =>
  `${formatDateOnly(date)} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`;

const getReceiptAmounts = (account, transactions = []) => {
  const openingBalance = Number(account?.OpeningBalance ?? account?.BalanceAmount) || 0;
  const collectedAmount = transactions.reduce((total, transaction) => {
    const amount = Number(transaction.Amount ?? transaction.amount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return {
    openingBalance,
    collectedAmount,
    totalAmount: openingBalance + collectedAmount,
  };
};

// Kept for optional use elsewhere (e.g. emailing/sharing a receipt preview).
// Not used for printing anymore — printing now goes through Bluetooth on
// both platforms, since the SC588 isn't an AirPrint-certified printer.
const escapeHtml = (value) => valueOrEmpty(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const createReceiptHtml = ({ user, account, transactions }) => {
  const { openingBalance, totalAmount } = getReceiptAmounts(account, transactions);
  const schemeCode = valueOrEmpty(account?.SchemeCode ?? account?.schemeCode ?? account?.schemecode);
  const leanAccountNumber = valueOrEmpty(account?.LeanAccountNumber ?? account?.leanAccountNumber);
  const leanAmount = account?.LeanAmount ?? account?.leanAmount ?? 0;
  const printedAt = formatReceiptDateTime();
  const headers = ['PrintHeader1', 'PrintHeader2', 'PrintHeader3', 'PrintHeader4']
    .map((key) => escapeHtml(user?.[key]))
    .filter(Boolean)
    .map((line) => `<div>${line}</div>`)
    .join('');
  const footers = ['PrintFooter1', 'PrintFooter2', 'PrintFooter3', 'PrintFooter4']
    .map((key) => escapeHtml(user?.[key]))
    .filter(Boolean)
    .map((line) => `<div>${line}</div>`)
    .join('');
  const receiptRows = (transactions || []).map((transaction) => `
    <tr><td>Receipt #${escapeHtml(transaction.tranNumber ?? transaction.TranNumber ?? transaction.ReceiptNumber ?? '-')}</td><td class="amount">${formatAmount(transaction.Amount ?? transaction.amount)}</td></tr>
  `).join('');

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; width: 100%; color: #111; font-size: 13px; }
    .center { text-align: center; } .rule { border-top: 1px solid #111; margin: 10px 0; }
    h1 { font-size: 18px; margin: 8px 0; } p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; } td { padding: 5px 0; border-bottom: 1px solid #ddd; }
    .amount { text-align: right; } .total { font-weight: 700; font-size: 15px; }
    .footer { text-align: center; margin-top: 14px; }
  </style></head><body>
    <div class="center">${headers}</div><div class="rule"></div>
    <p>Agent Number: ${escapeHtml(user?.AgentDeviceId)}</p><p>Agent Phone: ${escapeHtml(user?.MobileNumber)}</p>
    <div class="rule"></div><p>Date: ${escapeHtml(printedAt)}</p>
    <h1 class="center">${escapeHtml(account?.AccountName)}</h1>
    <p>Account No: ${escapeHtml(account?.AccountNumber)}</p>${schemeCode ? `<p>A/C Type : ${escapeHtml(schemeCode)}</p>` : ''}<p>Open Date: ${escapeHtml(formatDateOnly(account?.OpeningDate))}</p>${leanAccountNumber ? `<p>Lean A/c# ${escapeHtml(leanAccountNumber)}</p><p>Lean Amount: ${formatAmount(leanAmount)}</p>` : ''}
    <div class="rule"></div><p>Opening Balance: ${formatAmount(openingBalance)}</p>
    <table>${receiptRows}</table><div class="rule"></div>
    <p class="total">Total Amount: ${formatAmount(totalAmount)}</p>
    <div class="footer">${footers}<p>${escapeHtml(user?.PrintPoweredBy)}</p></div>
  </body></html>`;
};

// Mirrors CollectionViewModel.generateReceiptBytes(): headers, agent/account
// information, all receipts for the selected account, and configured footers.
// ESC/POS commands are deliberately kept as byte-compatible ASCII controls.
// This is what actually gets sent to the printer, on BOTH platforms now.
export const createReceiptText = ({ user, account, transactions }) => {
  const { openingBalance, totalAmount } = getReceiptAmounts(account, transactions);
  const schemeCode = valueOrEmpty(account?.SchemeCode ?? account?.schemeCode ?? account?.schemecode);
  const leanAccountNumber = valueOrEmpty(account?.LeanAccountNumber ?? account?.leanAccountNumber);
  const leanAmount = account?.LeanAmount ?? account?.leanAmount ?? 0;
  const printedAt = formatReceiptDateTime();
  const line = `${'-'.repeat(LINE_WIDTH)}\n`;
  const headers = ['PrintHeader1', 'PrintHeader2', 'PrintHeader3', 'PrintHeader4']
    .map((key) => valueOrEmpty(user?.[key]))
    .filter(Boolean)
    .join('\n');
  const footers = ['PrintFooter1', 'PrintFooter2', 'PrintFooter3', 'PrintFooter4']
    .map((key) => valueOrEmpty(user?.[key]))
    .filter(Boolean)
    .join('\n');
  const accountTransactions = transactions?.length ? transactions : [];
  const receiptRows = accountTransactions.map((transaction) =>
    receiptLine(`Receipt #${transaction.tranNumber ?? transaction.TranNumber ?? transaction.ReceiptNumber ?? '-'}`, formatAmount(transaction.Amount ?? transaction.amount))
  ).join('');

  return [
    '\x1B@', // Initialize printer
    '\x1Ba\x01', headers, '\n', // Centered heading
    '\x1Ba\x00', line,
    `Agent Number: ${valueOrEmpty(user?.AgentDeviceId)}\n`,
    `Agent Phone: ${valueOrEmpty(user?.MobileNumber)}\n`,
    line,
    `Date: ${printedAt}\n`,
    '\x1Ba\x01', valueOrEmpty(account?.AccountName), '\n', '\x1Ba\x00',
    `Account No: ${valueOrEmpty(account?.AccountNumber)}\n`,
    schemeCode ? `A/C Type : ${schemeCode}\n` : '',
    `Open Date: ${formatDateOnly(account?.OpeningDate)}\n`,
    leanAccountNumber ? `Lean A/c# ${leanAccountNumber}\nLean Amount: ${formatAmount(leanAmount)}\n` : '',
    line,
    receiptLine('Opening Balance', formatAmount(openingBalance)),
    receiptRows,
    line,
    '\x1BE\x01', receiptLine('Total Amount', formatAmount(totalAmount)), '\x1BE\x00',
    '\x1Ba\x01', line, footers, footers ? '\n' : '',
    valueOrEmpty(user?.PrintPoweredBy), '\n\n\n\n', '\x1Ba\x00',
  ].join('');
};

// ---------------------------------------------------------------------
// PRINTER DISCOVERY & CONNECTION
// ---------------------------------------------------------------------
// BLE has no persistent "bonded devices" list the way Classic did, so
// finding a printer means scanning for it. This wraps BluetoothService's
// callback-based scanForDevices() into a Promise that resolves with
// whatever was found in the given window.
const scanForPrinters = (timeoutMs = 10000) =>
  BluetoothService.discoverDevices({ timeoutMs });

const deviceKey = (item) => item?.id;

const getPrinterDevice = async (address = null) => {
  const connectedDevices = await BluetoothService.getConnectedDevices();
  const savedAddress = address || await AsyncStorage.getItem(PRINTER_ADDRESS_KEY);

  // Already connected to the remembered printer this session? Use it
  // directly, no need to scan.
  const alreadyConnected = savedAddress
    && connectedDevices.find((item) => deviceKey(item) === savedAddress);
  if (alreadyConnected) {
    return { devices: connectedDevices, device: alreadyConnected };
  }

  // Not connected — scan to find it (and any other nearby printers, in
  // case the saved one isn't reachable and the user needs to pick again).
  const scanned = await scanForPrinters();
  const savedDevice = savedAddress ? scanned.find((item) => deviceKey(item) === savedAddress) : null;

  return { devices: scanned, device: savedDevice || null };
};

const printToDevice = async (deviceId, text) => {
  if (!deviceId) throw new Error('Select a receipt printer first.');
  if (!(await BluetoothService.isConnected(deviceId))) {
    await BluetoothService.connectToDevice(deviceId);
  }
  await BluetoothService.sendData(deviceId, text);
  await AsyncStorage.setItem(PRINTER_ADDRESS_KEY, deviceId);
};

const ReceiptService = {
  // Actively scans for nearby printers (BLE has no bonded-device list to
  // read up front). Use this to populate a "select a printer" screen.
  getPrinters: async () => scanForPrinters(),

  printReceipt: async (receipt, printerAddress = null) => {
    const { devices, device } = await getPrinterDevice(printerAddress);
    if (!device) return { needsPrinterSelection: true, devices };
    try {
      await printToDevice(deviceKey(device), createReceiptText(receipt));
    } catch (error) {
      // If reconnecting to the remembered printer fails, fall back to
      // device selection instead of silently failing.
      console.log('Print failed, falling back to printer selection:', error);
      return { needsPrinterSelection: true, devices };
    }
    return { printed: true };
  },

  printWithSelectedPrinter: async (printerAddress, receipt) => {
    // printerAddress here is the BLE device id returned from getPrinters().
    await printToDevice(printerAddress, createReceiptText(receipt));
  },
};

export default ReceiptService;
