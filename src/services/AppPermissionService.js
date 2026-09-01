import { Alert, Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import LocationService from './LocationService';

const requestExplanation = () => new Promise((resolve) => {
  Alert.alert(
    'Permissions required',
    Platform.OS === 'ios'
      ? 'Pygma requires location and notification permissions to record collections and keep you informed.'
      : 'Pygma requires phone, location, and notification permissions to register this device, record collections, and keep you informed.',
    [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
    ],
    { cancelable: false }
  );
});

const showSettingsPrompt = () => {
  Alert.alert(
    'Allow permissions in Settings',
    'One or more required permissions are blocked. Open Pygma permissions in Settings to allow them.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]
  );
};

const getStartupPermissions = () => {
  const permissions = [
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];

  if (Number(Platform.Version) >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  return permissions;
};

const AppPermissionService = {
  // Mirrors MobileNumberFragment in the legacy Android project. Android only
  // exposes the notification runtime permission from API 33 onward; older
  // versions grant notification access at install time.
  requestStartupPermissions: async () => {
    if (Platform.OS === 'ios') {
      if (!(await requestExplanation())) return { allGranted: false, results: {} };

      const locationGranted = await LocationService.requestLocationPermission();
      const notificationGranted = Boolean(
        await NativeModules.PygmaNotificationPermission?.requestPermission()
      );
      const allGranted = locationGranted && notificationGranted;
      if (!allGranted) showSettingsPrompt();
      return {
        allGranted,
        results: { location: locationGranted, notifications: notificationGranted },
      };
    }
    if (Platform.OS !== 'android') return { allGranted: true, results: {} };

    const permissions = getStartupPermissions();
    const checks = await Promise.all(
      permissions.map((permission) => PermissionsAndroid.check(permission))
    );
    const missingPermissions = permissions.filter((permission, index) => !checks[index]);

    if (!missingPermissions.length) return { allGranted: true, results: {} };
    if (!(await requestExplanation())) return { allGranted: false, results: {} };

    const results = await PermissionsAndroid.requestMultiple(missingPermissions);
    const allGranted = missingPermissions.every(
      (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED
    );
    const hasBlockedPermission = missingPermissions.some(
      (permission) => results[permission] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    );

    if (hasBlockedPermission) showSettingsPrompt();
    return { allGranted, results };
  },
};

export default AppPermissionService;
