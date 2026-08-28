import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../database/DatabaseService';

// Matches fragment_splash.xml exactly:
// White background, centered vertical LinearLayout,
// 200dp app icon (@mipmap/ic_launcher), tagline text below (Heading2 = 20sp)
const SplashScreen = ({ navigation }) => {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await DatabaseService.initDatabase();
        // Android AppData.getLoginKey() is the sole resume condition. A live
        // collection must reopen with this existing session, not request a
        // fresh OTP (the backend deliberately rejects a second login while
        // that collection is Live).
        const loginKey = await AsyncStorage.getItem('loginKey');

        await new Promise((resolve) => setTimeout(resolve, 1500));

        if (loginKey) {
          navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'MobileNumber' }] });
        }
      } catch (error) {
        navigation.reset({ index: 0, routes: [{ name: 'MobileNumber' }] });
      }
    };
    initializeApp();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* @mipmap/ic_launcher - 200dp x 200dp - real converted app icon */}
      <Image
        source={require('../assets/images/logo.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
      {/* @string/tag_line, textSize=Heading2 (20sp) */}
      <Text style={styles.tagline}>Smart Collections... Smarter Growth</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  tagline: {
    fontSize: 20,
    color: '#000000',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default SplashScreen;
