/**
 * BluetoothPrinterService.js
 *
 * UNIFIED implementation using react-native-ble-plx for BOTH Android and
 * iOS, since your printer supports BLE. One codepath, one library, same
 * behavior on both platforms. The only platform difference is permissions:
 * Android needs an explicit runtime permission prompt; iOS shows its
 * system Bluetooth dialog automatically (driven by Info.plist strings).
 *
 * INSTALL
 *   npm install react-native-ble-plx buffer --legacy-peer-deps
 *   cd ios && pod install
 *
 * You can now remove react-native-bluetooth-classic if nothing else in
 * your app depends on it:
 *   npm uninstall react-native-bluetooth-classic
 *
 * ios/Info.plist — add:
 *   <key>NSBluetoothAlwaysUsageDescription</key>
 *   <string>This app uses Bluetooth to connect to your receipt printer.</string>
 * android/app/src/main/AndroidManifest.xml — make sure these are present
 * (react-native-ble-plx's docs cover this, but for reference):
 *   <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" tools:targetApi="s" />
 *   <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
 *   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
 *
 * NOTE ON CHARACTERISTIC UUIDs:
 * There's no single standard "printer service" UUID across vendors, so
 * connectToDevice() auto-discovers the first writable characteristic
 * across all of the device's services. Works for most generic ESC/POS
 * BLE printers without needing an exact UUID from the datasheet. If your
 * printer's SDK gives you exact service/characteristic UUIDs, you can
 * hardcode them for a faster, more reliable connect (see comment inline).
 */

import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const manager = new BleManager();

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
      const state = await manager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.log('Error checking bluetooth:', error);
      return false;
    }
  },

  requestBluetoothEnabled: async () => {
    if (await BluetoothService.isBluetoothEnabled()) return true;
    if (Platform.OS === 'android') {
      // Android allows prompting the user to turn Bluetooth on directly.
      try {
        await manager.enable();
        return true;
      } catch (error) {
        console.log('Bluetooth enable request failed:', error);
        return false;
      }
    }
    // iOS never lets apps flip Bluetooth on programmatically — only the
    // user can, via Control Center / Settings.
    return false;
  },

  // ---------------------------------------------------------------------
  // DISCOVERY
  // ---------------------------------------------------------------------
  /**
   * Scans for nearby BLE printers. Calls onDeviceFound(device) for each
   * unique device as it's found. Returns a stop function — scans don't
   * time out on their own, so call it (or wait for timeoutMs).
   */
  scanForDevices: (onDeviceFound, { timeoutMs = 15000, onError } = {}) => {
    const seen = new Set();
    let stopped = false;
    let timer;

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.log('BLE scan error:', error);
        if (!stopped && onError) onError(error);
        return;
      }
      if (!device || seen.has(device.id)) return;
      if (!device.name && !device.localName) return; // skip unnamed devices
      seen.add(device.id);
      onDeviceFound({ id: device.id, name: device.name || device.localName, rssi: device.rssi });
    });

    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      manager.stopDeviceScan();
    };
    timer = setTimeout(stop, timeoutMs);
    return stop;
  },

  /**
   * Promise-based discovery helper for screens that need the complete list.
   * Rejecting scan errors prevents the UI from being left in a searching state.
   */
  discoverDevices: ({ timeoutMs = 10000 } = {}) => new Promise((resolve, reject) => {
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
    completionTimer = setTimeout(() => finish(), timeoutMs);
  }),

  getConnectedDevices: async () => {
    try {
      const ids = Object.keys(writeTargets);
      if (ids.length === 0) return [];
      const devices = await manager.devices(ids);
      const flags = await Promise.all(devices.map((d) => manager.isDeviceConnected(d.id)));
      return devices.filter((_, i) => flags[i]);
    } catch (error) {
      console.log('Error getting connected devices:', error);
      return [];
    }
  },

  // ---------------------------------------------------------------------
  // CONNECTION
  // ---------------------------------------------------------------------
  connectToDevice: async (deviceId) => {
    try {
      const device = await manager.connectToDevice(deviceId, { autoConnect: false, timeout: 10000 });
      await device.discoverAllServicesAndCharacteristics();

      try { await device.requestMTU(185); } catch (e) { /* not all printers support this */ }

      const services = await device.services();
      let target = null;
      for (const service of services) {
        const characteristics = await service.characteristics();
        const writable = characteristics.find(isWritableChar);
        if (writable) {
          target = { serviceUUID: service.uuid, characteristicUUID: writable.uuid, withResponse: writable.isWritableWithResponse };
          break;
        }
      }
      // If your printer's SDK gives you exact UUIDs, skip the loop above
      // and just hardcode them here instead, e.g.:
      // target = { serviceUUID: '000018f0-...', characteristicUUID: '00002af1-...', withResponse: true };

      if (!target) throw new Error('No writable characteristic found — this device may not be a supported printer.');

      writeTargets[deviceId] = target;
      return device;
    } catch (error) {
      console.log('Connect failed:', error);
      throw error;
    }
  },

  disconnectDevice: async (deviceId) => {
    try { await manager.cancelDeviceConnection(deviceId); } catch (e) { /* already disconnected */ }
    delete writeTargets[deviceId];
  },

  isConnected: async (deviceId) => {
    try {
      return await manager.isDeviceConnected(deviceId);
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
    const target = writeTargets[deviceId];
    if (!target) throw new Error('Device not connected — call connectToDevice() first.');

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    for (const part of chunkBuffer(buffer)) {
      const base64Chunk = part.toString('base64');
      if (target.withResponse) {
        await manager.writeCharacteristicWithResponseForDevice(deviceId, target.serviceUUID, target.characteristicUUID, base64Chunk);
      } else {
        await manager.writeCharacteristicWithoutResponseForDevice(deviceId, target.serviceUUID, target.characteristicUUID, base64Chunk);
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
