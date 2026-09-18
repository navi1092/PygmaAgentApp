import {Buffer} from 'buffer';

const mockManager = {
  startDeviceScan: jest.fn(), state: jest.fn(), enable: jest.fn(), stopDeviceScan: jest.fn(),
  connectToDevice: jest.fn(), cancelDeviceConnection: jest.fn().mockResolvedValue(),
  writeCharacteristicWithResponseForDevice: jest.fn().mockResolvedValue(),
};
const mockClassic = {
  isBluetoothEnabled: jest.fn(), requestBluetoothEnabled: jest.fn(),
  getBondedDevices: jest.fn(), startDiscovery: jest.fn(), cancelDiscovery: jest.fn().mockResolvedValue(),
  pairDevice: jest.fn().mockResolvedValue(), connectToDevice: jest.fn().mockResolvedValue({}),
  writeToDevice: jest.fn(),
};
jest.mock('react-native', () => ({
  Platform: {OS: 'android', Version: 35},
  PermissionsAndroid: {
    PERMISSIONS: {BLUETOOTH_CONNECT: 'connect', BLUETOOTH_SCAN: 'scan', ACCESS_FINE_LOCATION: 'location'},
    RESULTS: {GRANTED: 'granted'}, requestMultiple: jest.fn(),
  },
}));
jest.mock('react-native-ble-plx', () => ({BleManager: jest.fn(() => mockManager)}));
jest.mock('react-native-bluetooth-classic', () => ({__esModule: true, default: mockClassic}));
const {Platform, PermissionsAndroid} = require('react-native');
const service = require('../src/services/BluetoothService').default;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.Version = 35;
});
afterEach(() => jest.restoreAllMocks());

test('Android 12+ requests both Nearby Devices permissions', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({connect: 'granted', scan: 'granted'});
  expect(await service.requestBluetoothPermission()).toBe(true);
  expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith(['connect', 'scan']);
});
test('denied permission prevents readiness', async () => {
  PermissionsAndroid.requestMultiple.mockResolvedValue({connect: 'granted', scan: 'denied'});
  expect(await service.requestBluetoothPermission()).toBe(false);
});
test('older Android requests location for scanning', async () => {
  Platform.Version = 30;
  PermissionsAndroid.requestMultiple.mockResolvedValue({location: 'granted'});
  expect(await service.requestBluetoothPermission()).toBe(true);
  expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith(['location']);
});
test.each([true, false])('enable dialog returns user decision %s', async (allowed) => {
  mockClassic.isBluetoothEnabled.mockResolvedValue(false);
  mockClassic.requestBluetoothEnabled.mockResolvedValue(allowed);
  expect(await service.requestBluetoothEnabled()).toBe(allowed);
  expect(mockClassic.requestBluetoothEnabled).toHaveBeenCalledTimes(1);
  expect(mockManager.enable).not.toHaveBeenCalled();
});
test('already enabled adapter skips dialog', async () => {
  mockClassic.isBluetoothEnabled.mockResolvedValue(true);
  expect(await service.requestBluetoothEnabled()).toBe(true);
  expect(mockClassic.requestBluetoothEnabled).not.toHaveBeenCalled();
});
test('discovery includes paired, newly discovered Classic and BLE printers', async () => {
  mockClassic.getBondedDevices.mockResolvedValue([{address: 'AA', name: 'Paired'}]);
  mockClassic.startDiscovery.mockResolvedValue([{address: 'AA'}, {address: 'BB', name: 'New'}]);
  jest.spyOn(service, 'discoverBleDevices').mockResolvedValue([{id: 'CC', name: 'BLE'}]);
  const devices = await service.discoverDevices();
  expect(devices.map(device => device.id)).toEqual(['classic:AA', 'CC', 'classic:BB']);
});
test('paired printers remain available when discovery fails', async () => {
  mockClassic.getBondedDevices.mockResolvedValue([{address: 'AA', name: 'Paired'}]);
  mockClassic.startDiscovery.mockRejectedValue(new Error('Scan unavailable'));
  jest.spyOn(service, 'discoverBleDevices').mockRejectedValue(new Error('Location disabled'));
  expect(await service.discoverDevices()).toEqual([{id: 'classic:AA', name: 'Paired (Classic)'}]);
});
test('selection pairs a new Classic printer before connecting and sends raw receipt bytes', async () => {
  mockClassic.getBondedDevices.mockResolvedValue([]);
  mockClassic.writeToDevice.mockResolvedValue(true);
  await service.connectToDevice('classic:BB');
  expect(mockClassic.pairDevice).toHaveBeenCalledWith('BB');
  expect(mockClassic.connectToDevice).toHaveBeenCalledWith('BB');
  expect(mockClassic.pairDevice.mock.invocationCallOrder[0]).toBeLessThan(mockClassic.connectToDevice.mock.invocationCallOrder[0]);
  const receipt = Buffer.from([27, 64, 65, 10]);
  await service.sendData('classic:BB', receipt);
  expect(mockClassic.writeToDevice).toHaveBeenCalledWith('BB', receipt);
});
test('failed Classic write is not reported as printed', async () => {
  mockClassic.writeToDevice.mockResolvedValue(false);
  await expect(service.sendData('classic:BB', 'receipt')).rejects.toThrow('did not accept');
});
test('BLE receipts respect default MTU when negotiation fails', async () => {
  const device = {
    discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(),
    services: jest.fn().mockResolvedValue([{
      uuid: 'service', characteristics: async () => [{uuid: 'write', isWritableWithResponse: true}],
    }]),
    requestMTU: jest.fn().mockRejectedValue(new Error('unsupported')),
  };
  mockManager.connectToDevice.mockResolvedValue(device);
  await service.connectToDevice('ble-id');
  await service.sendData('ble-id', Buffer.alloc(65, 65));
  const chunks = mockManager.writeCharacteristicWithResponseForDevice.mock.calls.map(call => Buffer.from(call[3], 'base64'));
  expect(chunks.map(chunk => chunk.length)).toEqual([20, 20, 20, 5]);
  expect(Buffer.concat(chunks)).toEqual(Buffer.alloc(65, 65));
});

test('BLE scan-start rejection stops scanning and reaches the caller', async () => {
  mockManager.startDeviceScan.mockRejectedValue(new Error('Bluetooth unavailable'));
  await expect(service.discoverBleDevices()).rejects.toThrow('Bluetooth unavailable');
  expect(mockManager.stopDeviceScan).toHaveBeenCalled();
});
test('synchronous BLE scan errors clean up without waiting for timeout', async () => {
  mockManager.startDeviceScan.mockImplementation((_, options, callback) => callback(new Error('Scan denied')));
  await expect(service.discoverBleDevices()).rejects.toThrow('Scan denied');
  expect(mockManager.stopDeviceScan).toHaveBeenCalled();
});
