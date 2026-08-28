module.exports = {
  dependencies: {
    'react-native-bluetooth-classic': {
      platforms: {
        ios: null, // disable autolinking on iOS only — keeps Android working
      },
    },
  },
};