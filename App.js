import React, { useEffect, useState } from 'react';
import { AppState, StatusBar } from 'react-native';
import { DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import PygmaLoader from './src/components/PygmaLoader';
import { UI_COLORS } from './src/utils/theme';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import MobileNumberScreen from './src/screens/MobileNumberScreen';
import OTPScreen from './src/screens/OTPScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CollectionScreen from './src/screens/CollectionScreen';

// Services
import DatabaseService from './src/database/DatabaseService';
import ConnectivityService from './src/services/ConnectivityService';
import ApiService from './src/services/ApiService';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();
const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: UI_COLORS.surface } };

const App = () => {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database
        await DatabaseService.initDatabase();
        console.log('App initialized successfully');
        ConnectivityService.start();
      } catch (error) {
        console.log('Error initializing app:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
    // Reauthenticate on expiry; local collections remain available for the
    // same agent to resume uploading after login.
    ApiService.setSessionExpiredHandler(() => {
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'MobileNumber' }] });
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      // iOS may suspend JavaScript while backgrounded. Retry the Android-like
      // pending queue immediately when the user returns to the app.
      if (nextState === 'active') ConnectivityService.syncIfOnline();
    });
    return () => {
      appStateSubscription.remove();
      ConnectivityService.stop();
      ApiService.setSessionExpiredHandler(null);
    };
  }, []);

  if (isInitializing) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={UI_COLORS.surface} />
        <PygmaLoader fullScreen />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: UI_COLORS.surface }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'default',
              contentStyle: { backgroundColor: UI_COLORS.surface },
            }}
          >
            <Stack.Screen
              name="Splash"
              component={SplashScreen}
              options={{ animation: 'none' }}
            />
            <Stack.Screen
              name="MobileNumber"
              component={MobileNumberScreen}
              options={{ animation: 'none' }}
            />
            <Stack.Screen
              name="OTP"
              component={OTPScreen}
            />
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ animation: 'none' }}
            />
            <Stack.Screen
              name="Collection"
              component={CollectionScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
