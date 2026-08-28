import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import BluetoothService from './BluetoothService';
import RNPrint from 'react-native-print';

const PRINTER_ADDRESS_KEY = 'receiptPrinterAddress';
const LINE_WIDTH = 32;

const valueOrEmpty = (value) => String(value ?? '').trim();

const receiptLine = (label, value) => {
  const text = valueOrEmpty(value);
  const padding = Math.max(LINE_WIDTH - label.length - text.length, 1);
  return `${label}${' '.repeat(padding)}${text}\n`;
};

const formatAmount = (value) => Number(value || 0).toFixed(2);

const escapeHtml = (value) => valueOrEmpty(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const createReceiptHtml = ({ user, account, transactions }) => {
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
    <p>Agent Device ID: ${escapeHtml(user?.AgentDeviceId)}</p><p>Agent Phone: ${escapeHtml(user?.MobileNumber)}</p>
    <div class="rule"></div><p>Date: ${escapeHtml(new Date(account?.LastTranDate || Date.now()).toLocaleString())}</p>
    <h1 class="center">${escapeHtml(account?.AccountName)}</h1>
    <p>Account No: ${escapeHtml(account?.AccountNumber)}</p><p>Open Date: ${escapeHtml(account?.OpeningDate)}</p>
    <div class="rule"></div><p>Opening Balance: ${formatAmount(account?.OpeningBalance ?? account?.BalanceAmount)}</p>
    <table>${receiptRows}</table><div class="rule"></div>
    <p class="total">Total Amount: ${formatAmount(account?.BalanceAmount)}</p>
    <div class="footer">${footers}<p>${escapeHtml(user?.PrintPoweredBy)}</p></div>
  </body></html>`;
};

// Mirrors CollectionViewModel.generateReceiptBytes(): headers, agent/account
// information, all receipts for the selected account, and configured footers.
// ESC/POS commands are deliberately kept as byte-compatible ASCII controls.
export const createReceiptText = ({ user, account, transactions }) => {
  const line = `${'-'.repeat(LINE_WIDTH)}\n`;
  const headers = ['PrintHeader1', 'PrintHeader2', 'PrintHeader3', 'PrintHeader4']
    .map((key) => valueOrEmpty(user?.[key]))
    .filter(Boolean)
    .join('\n');
  const footers = ['PrintFooter1', 'PrintFooter2', 'PrintFooter3', 'PrintFooter4']
    .map((key) => valueOrEmpty(user?.[key]))
    .filter(Boolean)
    .join('\n');
  const accountTransactions = transactions.length ? transactions : [];
  const receiptRows = accountTransactions.map((transaction) =>
    receiptLine(`Receipt #${transaction.tranNumber ?? transaction.TranNumber ?? transaction.ReceiptNumber ?? '-'}`, formatAmount(transaction.Amount ?? transaction.amount))
  ).join('');

  return [
    '\x1B@', // Initialize printer
    '\x1Ba\x01', headers, '\n', // Centered heading
    '\x1Ba\x00', line,
    `Agent Device ID: ${valueOrEmpty(user?.AgentDeviceId)}\n`,
    `Agent Phone: ${valueOrEmpty(user?.MobileNumber)}\n`,
    line,
    `Date: ${new Date(account?.LastTranDate || Date.now()).toLocaleString()}\n`,
    '\x1Ba\x01', valueOrEmpty(account?.AccountName), '\n', '\x1Ba\x00',
    `Account No: ${valueOrEmpty(account?.AccountNumber)}\n`,
    `Open Date: ${valueOrEmpty(account?.OpeningDate)}\n`,
    account?.LeanAccountNumber ? `Lean A/c#: ${account.LeanAccountNumber}\nLean Amount: ${formatAmount(account.LeanAmount)}\n` : '',
    line,
    receiptLine('Opening Balance', formatAmount(account?.OpeningBalance ?? account?.BalanceAmount)),
    receiptRows,
    line,
    '\x1BE\x01', receiptLine('Total Amount', formatAmount(account?.BalanceAmount)), '\x1BE\x00',
    '\x1Ba\x01', line, footers, footers ? '\n' : '',
    valueOrEmpty(user?.PrintPoweredBy), '\n\n\n\n', '\x1Ba\x00',
  ].join('');
};

const getPrinterDevice = async (address = null) => {
  const devices = await BluetoothService.getAvailableDevices();
  const savedAddress = address || await AsyncStorage.getItem(PRINTER_ADDRESS_KEY);
  return {
    devices,
    device: savedAddress ? devices.find((item) => item.address === savedAddress) : null,
  };
};

const printToDevice = async (device, text) => {
  if (!device) throw new Error('Select a receipt printer first.');
  if (!(await device.isConnected())) await device.connect();
  await device.write(text, 'utf8');
  await AsyncStorage.setItem(PRINTER_ADDRESS_KEY, device.address);
};

const ReceiptService = {
  getPrinters: async () => {
    const { devices } = await getPrinterDevice();
    return devices;
  },

  printReceipt: async (receipt, printerAddress = null) => {
    if (Platform.OS === 'ios') {
      await RNPrint.print({ html: createReceiptHtml(receipt) });
      return { printed: true };
    }
    const { devices, device } = await getPrinterDevice(printerAddress);
    if (!device) return { needsPrinterSelection: true, devices };
    await printToDevice(device, createReceiptText(receipt));
    return { printed: true };
  },

  printWithSelectedPrinter: async (printerAddress, receipt) => {
    if (Platform.OS === 'ios') {
      await RNPrint.print({ html: createReceiptHtml(receipt) });
      return;
    }
    const { devices } = await getPrinterDevice();
    const device = devices.find((item) => item.address === printerAddress);
    if (!device) throw new Error('The selected printer is unavailable. Turn it on and try again.');
    await printToDevice(device, createReceiptText(receipt));
  },
};

export default ReceiptService;
