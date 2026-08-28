import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

const LocationService = {
  requestLocationPermission: async () => {
    if (Platform.OS === 'ios') {
      // react-native-geolocation-service does not request iOS permission
      // merely by importing it. Ask before reading a collection location.
      const authorization = await Geolocation.requestAuthorization('whenInUse');
      return authorization === 'granted';
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Pygma Location Permission',
          message: 'Pygma needs access to your location for collection tracking.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  },

  getCurrentLocation: () => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          console.log('Location error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 1000,
        }
      );
    });
  },

  watchLocation: (onLocationChange, onError) => {
    try {
      const watchId = Geolocation.watchPosition(
        (position) => {
          onLocationChange({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          onError(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 1000,
          distanceFilter: 10, // Update every 10 meters
        }
      );
      return watchId;
    } catch (error) {
      onError(error);
      return null;
    }
  },

  stopWatchingLocation: (watchId) => {
    if (watchId !== null && watchId !== undefined) {
      Geolocation.clearWatch(watchId);
    }
  },

  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  },
};

export default LocationService;
