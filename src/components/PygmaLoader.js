import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { UI_COLORS } from '../utils/theme';

const PygmaLoader = ({ size = 'large', fullScreen = false, style }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const dimension = typeof size === 'number' ? size : size === 'small' ? 28 : 96;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View
      style={[styles.container, fullScreen && styles.fullScreen, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
    >
      <Animated.Image
        source={require('../assets/images/logo.png')}
        resizeMode="contain"
        style={{
          width: dimension,
          height: dimension,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  fullScreen: { flex: 1, backgroundColor: UI_COLORS.surface },
});

export default PygmaLoader;
