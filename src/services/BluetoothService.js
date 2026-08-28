import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const getBluetoothClassic = () => {
  if (Platform.OS !== 'android') return null;
  return require('react-native-bluetooth-classic').default;
};

const BluetoothService = {
  requestBluetoothPermission: async () => {
    if (Platform.OS === 'ios') {
      try {
        return Boolean(await NativeModules.PygmaBluetoothPermission?.requestPermission());
      } catch (error) {
        console.warn('Bluetooth permission request failed:', error);
        return false;
      }
    }
    if (Platform.OS !== 'android') return false;
    // BLUETOOTH_CONNECT and BLUETOOTH_SCAN are runtime permissions only on
    // Android 12 (API 31) and newer. Earlier Android versions grant the
    // manifest permissions at install time.
    if (Number(Platform.Version) < 31) return true;
    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ];
      const granted = await PermissionsAndroid.requestMultiple(permissions);
      return permissions.every((permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED);
    } catch (error) {
      console.warn('Bluetooth permission request failed:', error);
      return false;
    }
  },

  isBluetoothEnabled: async () => {
    const bluetooth = getBluetoothClassic();
    if (!bluetooth) return false;
    try {
      return await bluetooth.isBluetoothEnabled();
    } catch (error) {
      console.log('Error checking bluetooth:', error);
      return false;
    }
  },

  getAvailableDevices: async () => {
    const bluetooth = getBluetoothClassic();
    if (!bluetooth) return [];
    try {
      return (await bluetooth.getBondedDevices()) || [];
    } catch (error) {
      console.log('Error getting devices:', error);
      return [];
    }
  },

  connectToDevice: async (deviceId) => {
    const bluetooth = getBluetoothClassic();
    if (!bluetooth) throw new Error('Bluetooth is unavailable on this platform.');
    return bluetooth.connectToDevice(deviceId);
  },

  sendData: async (deviceId, data) => {
    const bluetooth = getBluetoothClassic();
    if (!bluetooth) throw new Error('Bluetooth is unavailable on this platform.');
    return bluetooth.sendData(deviceId, data);
  },

  disconnectDevice: async (deviceId) => {
    const bluetooth = getBluetoothClassic();
    if (bluetooth) await bluetooth.disconnectDevice(deviceId);
  },

  isConnected: async (deviceId) => {
    const bluetooth = getBluetoothClassic();
    if (!bluetooth) return false;
    try {
      const device = await bluetooth.getDevice(deviceId);
      return device?.connected || false;
    } catch (error) {
      console.log('Error checking connection status:', error);
      return false;
    }
  },
};

export default BluetoothService;
