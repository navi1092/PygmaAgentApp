import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// Load Classic only on Android; iOS continues to use BLE.
const classic = Platform.OS === 'android'
  ? require('react-native-bluetooth-classic').default : null;
const isClassic = (id) => id.startsWith('classic:');
const classicAddress = (id) => id.slice('classic:'.length);
const classicDevice = (device) => ({
  id: `classic:${device.address}`,
  name: `${device.name || 'Bluetooth Printer'} (Classic)`,
});

const manager = new BleManager();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A writable characteristic can have either of these properties.
const isWritableChar = (char) => char.isWritableWithResponse || char.isWritableWithoutResponse;

// BLE packets are small. Chunk data even after requesting a larger MTU,
// since some printers ignore MTU requests.
const chunkBuffer = (buffer, size = 180) => {
  const chunks = [];
  for (let i = 0; i < buffer.length; i += size) chunks.push(buffer.slice(i, i + size));
  return chunks;
};

// Cache the discovered writable characteristic per device so print calls
// after connect() don't re-discover services every time.
const writeTargets = {};

// Looks across all of a device's services for the first writable
// characteristic. Returns null if none found yet (caller decides whether
// to retry).
const findWritableTarget = async (device) => {
  const services = await device.services();
  for (const service of services) {
    const characteristics = await service.characteristics();
    const writable = characteristics.find(isWritableChar);
    if (writable) {
      return {
        serviceUUID: service.uuid,
        characteristicUUID: writable.uuid,
        withResponse: writable.isWritableWithResponse,
      };
    }
  }
  return null;
};

const BluetoothService = {
  // ---------------------------------------------------------------------
  // PERMISSIONS
  // ---------------------------------------------------------------------
  requestBluetoothPermission: async () => {
    if (Platform.OS === 'ios') {
      // ble-plx triggers iOS's native permission dialog automatically on
      // first scan/connect (using the Info.plist strings above). Nothing
      // to request manually — just confirm the adapter is usable.
      return new Promise((resolve) => {
        const subscription = manager.onStateChange((state) => {
          if (state !== 'Unknown') {
            subscription.remove();
            resolve(state === 'PoweredOn');
          }
        }, true);
      });
    }

    if (Platform.OS !== 'android') return false;

    // BLUETOOTH_CONNECT and BLUETOOTH_SCAN are runtime permissions only on
    // Android 12 (API 31) and newer. Earlier Android versions need
    // location permission instead (a BLE-scanning quirk on older Android).
    try {
      const permissions = Number(Platform.Version) >= 31
        ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const granted = await PermissionsAndroid.requestMultiple(permissions);
      return permissions.every((permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED);
    } catch (error) {
      console.warn('Bluetooth permission request failed:', error);
      return false;
    }
  },

  // ---------------------------------------------------------------------
  // ADAPTER STATE
  // ---------------------------------------------------------------------
  isBluetoothEnabled: async () => {
    try {
      if (classic) return await classic.isBluetoothEnabled();
      const state = await manager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.log('Error checking bluetooth:', error);
      return false;
    }
  },

  requestBluetoothEnabled: async () => {
    if (await BluetoothService.isBluetoothEnabled()) return true;
    if (Platform.OS !== 'android') {
      // iOS never lets apps flip Bluetooth on programmatically — only the
      // user can, via Control Center / Settings.
      return false;
    }

    // Uses ACTION_REQUEST_ENABLE with an activity result, including cancellation.
    // Direct adapter.enable() fails for apps targeting Android 13 and above.
    return classic.requestBluetoothEnabled();
  },

  // ---------------------------------------------------------------------
  // DISCOVERY
  // ---------------------------------------------------------------------
  /**
   * Scans for nearby BLE printers. Calls onDeviceFound(device) for each
   * unique device as it's found. Returns a stop function — scans don't
   * time out on their own, so call it (or wait for timeoutMs).
   *
   * Unnamed devices are now KEPT (previously skipped). Many printers only
   * expose a name after connecting, or use a manufacturer-specific
   * advertising packet that Android's BLE stack surfaces differently than
   * iOS - dropping unnamed devices was likely hiding the printer entirely
   * on Android.
   */
  scanForDevices: (onDeviceFound, { timeoutMs = 15000, onError } = {}) => {
    const seen = new Set();
    let stopped = false;
    let timer;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      manager.stopDeviceScan();
    };
    const fail = (error) => {
      if (stopped) return;
      stop();
      if (onError) onError(error);
    };
    timer = setTimeout(stop, timeoutMs);
    try {
      const started = manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) return fail(error);
        if (stopped || !device || seen.has(device.id)) return;
        seen.add(device.id);
        onDeviceFound({
          id: device.id,
          name: device.name || device.localName || 'Unknown Printer',
          rssi: device.rssi,
        });
      });
      // Recent ble-plx versions also reject the scan-start promise.
      if (started?.catch) started.catch(fail);
    } catch (error) {
      fail(error);
    }

    return stop;
  },

  /**
   * Promise-based discovery helper for screens that need the complete list.
   * Rejecting scan errors prevents the UI from being left in a searching state.
   */
  discoverBleDevices: ({ timeoutMs = 10000 } = {}) => new Promise((resolve, reject) => {
    const devices = [];
    let settled = false;
    let stopScan = () => {};
    let completionTimer;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(completionTimer);
      stopScan();
      if (error) reject(error);
      else resolve(devices);
    };

    stopScan = BluetoothService.scanForDevices(
      (device) => devices.push(device),
      { timeoutMs, onError: finish },
    );
    if (settled) stopScan();
    else completionTimer = setTimeout(() => finish(), timeoutMs);
  }),

  discoverDevices: async (options = {}) => {
    if (!classic) return BluetoothService.discoverBleDevices(options);
    const devices = new Map();
    const addClassic = (items) => items.forEach((item) => {
      const device = classicDevice(item);
      devices.set(device.id, device);
    });
    console.info('[Printer] Reading paired devices');
    addClassic(await classic.getBondedDevices());
    console.info('[Printer] Paired devices:', devices.size);
    let scanError;
    try {
      const bleDevices = await BluetoothService.discoverBleDevices(options);
      bleDevices.forEach((device) => devices.set(device.id, device));
    } catch (error) {
      scanError = error;
    }
    // Avoid running Classic discovery and BLE scanning on the radio together.
    const timer = setTimeout(() => {
      classic.cancelDiscovery().catch(() => {});
    }, options.timeoutMs || 10000);
    try {
      addClassic(await classic.startDiscovery());
    } catch (error) {
      scanError = scanError || error;
    } finally {
      clearTimeout(timer);
    }
    if (!devices.size && scanError) throw scanError;
    return [...devices.values()];
  },

  getConnectedDevices: async () => {
    try {
      const ids = Object.keys(writeTargets);
      const connectedClassic = classic
        ? (await classic.getConnectedDevices()).map(classicDevice) : [];
      if (ids.length === 0) return connectedClassic;
      const devices = await manager.devices(ids);
      const flags = await Promise.all(devices.map((d) => manager.isDeviceConnected(d.id)));
      return [...connectedClassic, ...devices.filter((_, i) => flags[i])];
    } catch (error) {
      console.log('Error getting connected devices:', error);
      return [];
    }
  },

  // ---------------------------------------------------------------------
  // CONNECTION
  // ---------------------------------------------------------------------
  connectToDevice: async (deviceId) => {
    if (classic && isClassic(deviceId)) {
      await classic.cancelDiscovery();
      const address = classicAddress(deviceId);
      const bonded = await classic.getBondedDevices();
      if (!bonded.some((device) => device.address === address)) {
        await classic.pairDevice(address);
      }
      return classic.connectToDevice(address);
    }
    manager.stopDeviceScan();
    try {
      const device = await manager.connectToDevice(deviceId, { autoConnect: false, timeout: 10000 });
      await device.discoverAllServicesAndCharacteristics();

      // Android sometimes reports discovery as "complete" a moment before
      // characteristics are actually queryable. Retry once after a short
      // delay before giving up.
      let target = await findWritableTarget(device);
      if (!target) {
        await sleep(300);
        target = await findWritableTarget(device);
      }

      // If your printer's SDK gives you exact UUIDs, skip discovery above
      // and just hardcode them here instead, e.g.:
      // target = { serviceUUID: '000018f0-...', characteristicUUID: '00002af1-...', withResponse: true };

      if (!target) throw new Error('No writable characteristic found — this device may not be a supported printer.');

      let mtu = Platform.OS === 'android' ? 23 : device.mtu;

      // Request a larger MTU so fewer write chunks are needed. Some
      // Android BLE stacks reject the very first request right after
      // connecting - retry once, then proceed regardless since chunking
      // already handles small MTUs.
      try {
        mtu = (await device.requestMTU(185)).mtu;
      } catch (error) {
        try {
          await sleep(200);
          mtu = (await device.requestMTU(185)).mtu;
        } catch (retryError) {
          console.log('MTU request not supported by this printer, continuing with default MTU.');
        }
      }

      // Preserve the working iOS packet size; Android must respect its MTU.
      target.chunkSize = Platform.OS === 'android'
        ? Math.min(180, Math.max(20, (mtu || 23) - 3)) : 180;
      writeTargets[deviceId] = target;
      return device;
    } catch (error) {
      delete writeTargets[deviceId];
      await manager.cancelDeviceConnection(deviceId).catch(() => {});
      console.log('Connect failed:', error);
      throw error;
    }
  },

  disconnectDevice: async (deviceId) => {
    if (classic && isClassic(deviceId)) {
      return classic.disconnectFromDevice(classicAddress(deviceId));
    }
    try { await manager.cancelDeviceConnection(deviceId); } catch (e) { /* already disconnected */ }
    delete writeTargets[deviceId];
  },

  isConnected: async (deviceId) => {
    try {
      if (classic && isClassic(deviceId)) {
        return await classic.isDeviceConnected(classicAddress(deviceId));
      }
      return !!writeTargets[deviceId] && await manager.isDeviceConnected(deviceId);
    } catch (error) {
      return false;
    }
  },

  // ---------------------------------------------------------------------
  // SENDING DATA
  // ---------------------------------------------------------------------
  /**
   * data: a Buffer, Uint8Array, or string of raw bytes (e.g. ESC/POS commands).
   */
  sendData: async (deviceId, data) => {
    if (classic && isClassic(deviceId)) {
      const written = await classic.writeToDevice(classicAddress(deviceId), Buffer.from(data));
      if (!written) throw new Error('Printer did not accept the receipt. Check its connection and try again.');
      return true;
    }
    const target = writeTargets[deviceId];
    if (!target) throw new Error('Device not connected — call connectToDevice() first.');

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    for (const part of chunkBuffer(buffer, target.chunkSize)) {
      const base64Chunk = part.toString('base64');
      if (target.withResponse) {
        await manager.writeCharacteristicWithResponseForDevice(deviceId, target.serviceUUID, target.characteristicUUID, base64Chunk);
      } else {
        await manager.writeCharacteristicWithoutResponseForDevice(deviceId, target.serviceUUID, target.characteristicUUID, base64Chunk);
        if (Platform.OS === 'android') {
          await sleep(20); // Allow Android printers to drain unacknowledged writes.
        }
      }
    }
    return true;
  },

  // ---------------------------------------------------------------------
  // HIGH-LEVEL PRINT HELPER
  // ---------------------------------------------------------------------
  /**
   * Connects (if needed), sends plain text via basic ESC/POS commands,
   * feeds a few lines, and optionally cuts. Same call, same behavior,
   * on both Android and iOS.
   */
  printText: async (deviceId, text, { cutAfter = true } = {}) => {
    const alreadyConnected = await BluetoothService.isConnected(deviceId);
    if (!alreadyConnected) await BluetoothService.connectToDevice(deviceId);

    const ESC = 0x1b;
    const GS = 0x1d;
    const init = Buffer.from([ESC, 0x40]); // initialize printer
    const body = Buffer.from(`${text}\n\n\n`, 'utf-8');
    const cut = cutAfter ? Buffer.from([GS, 0x56, 0x00]) : Buffer.alloc(0); // full cut

    const payload = Buffer.concat([init, body, cut]);
    await BluetoothService.sendData(deviceId, payload);
    return true;
  },
};

export default BluetoothService;
