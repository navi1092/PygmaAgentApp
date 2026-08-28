import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
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
    // AuthInterceptor.java clears storage/database once on a 401 and Android
    // restarts MainActivity. Reset to iOS's entry screen after the equivalent
    // cleanup has completed.
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2874b2' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'default',
              contentStyle: { backgroundColor: '#2874b2' },
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
