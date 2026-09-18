import {Buffer} from 'buffer';

const mockManager = {
  state: jest.fn(), onStateChange: jest.fn(), startDeviceScan: jest.fn(),
  stopDeviceScan: jest.fn(), connectToDevice: jest.fn(),
  isDeviceConnected: jest.fn().mockResolvedValue(true),
  cancelDeviceConnection: jest.fn().mockResolvedValue(),
  writeCharacteristicWithResponseForDevice: jest.fn().mockResolvedValue(),
  writeCharacteristicWithoutResponseForDevice: jest.fn().mockResolvedValue(),
};
jest.mock('react-native', () => ({
  Platform: {OS: 'ios', Version: '18.0'},
  PermissionsAndroid: {requestMultiple: jest.fn()},
}));
jest.mock('react-native-ble-plx', () => ({BleManager: jest.fn(() => mockManager)}));
// iOS does not link this native library. Fail if the service loads it.
jest.mock('react-native-bluetooth-classic', () => {
  throw new Error('Android Classic module loaded on iOS');
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(),
}));
const {PermissionsAndroid} = require('react-native');
const service = require('../src/services/BluetoothService').default;
const receipts = require('../src/services/ReceiptService').default;

beforeEach(() => jest.clearAllMocks());

test('iOS permission uses BLE adapter state without requesting Android permissions', async () => {
  const remove = jest.fn();
  mockManager.onStateChange.mockImplementation(callback => {
    Promise.resolve().then(() => callback('PoweredOn'));
    return {remove};
  });
  expect(await service.requestBluetoothPermission()).toBe(true);
  expect(remove).toHaveBeenCalled();
  expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
});
test.each([['PoweredOn', true], ['PoweredOff', false]])('iOS adapter state %s returns %s', async (state, enabled) => {
  mockManager.state.mockResolvedValue(state);
  expect(await service.requestBluetoothEnabled()).toBe(enabled);
});
test('iOS discovery returns BLE UUIDs without loading Classic', async () => {
  mockManager.startDeviceScan.mockImplementation((_, options, callback) => {
    callback(null, {id: 'ios-printer-uuid', name: 'Receipt printer', rssi: -40});
  });
  expect(await service.discoverDevices({timeoutMs: 1})).toEqual([
    {id: 'ios-printer-uuid', name: 'Receipt printer', rssi: -40},
  ]);
});
test.each([true, false])('iOS retains 180-byte receipt writes, withResponse=%s', async withResponse => {
  const id = `ios-printer-${withResponse}`;
  mockManager.connectToDevice.mockResolvedValue({
    mtu: 23,
    requestMTU: jest.fn().mockResolvedValue({mtu: 23}),
    discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(),
    services: async () => [{uuid: 'service', characteristics: async () => [{
      uuid: 'write', isWritableWithResponse: withResponse, isWritableWithoutResponse: !withResponse,
    }]}],
  });
  await service.connectToDevice(id);
  await service.sendData(id, Buffer.alloc(365, 65));
  const writer = withResponse ? mockManager.writeCharacteristicWithResponseForDevice
    : mockManager.writeCharacteristicWithoutResponseForDevice;
  expect(writer.mock.calls.map(call => Buffer.from(call[3], 'base64').length)).toEqual([180, 180, 5]);

  writer.mockClear();
  await receipts.printWithSelectedPrinter(id, {
    account: {AccountNumber: '123'}, transactions: [{tranNumber: 7, Amount: 50}],
  });
  const printedReceipt = Buffer.concat(writer.mock.calls.map(call => Buffer.from(call[3], 'base64'))).toString();
  expect(printedReceipt).toContain('Account No: 123');
  expect(printedReceipt).toContain('Receipt #7');

  writer.mockClear();
  await receipts.printCollectionSummaryWithSelectedPrinter(id, {summary: {totalReceipts: 1, totalAmount: 50}});
  const printedSummary = Buffer.concat(writer.mock.calls.map(call => Buffer.from(call[3], 'base64'))).toString();
  expect(printedSummary).toContain('COLLECTION SUMMARY');
  expect(printedSummary).toContain('50.00');
});
