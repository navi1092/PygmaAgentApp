import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import PygmaLoader from '../components/PygmaLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DatabaseService from '../database/DatabaseService';
import { DEFAULT_PRIMARY_COLOR, getPrimaryColor, UI_COLORS, UI_FONT } from '../utils/theme';
import ApiService, { APP_VERSION_CODE } from '../services/ApiService';

// Matches fragment_splash.xml exactly:
// White background, centered vertical LinearLayout,
// 200dp app icon (@mipmap/ic_launcher), tagline text below (Heading2 = 20sp)
const SplashScreen = ({ navigation }) => {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [updateInfo, setUpdateInfo] = useState(null);

  const continueToApp = async () => {
    const loginKey = await AsyncStorage.getItem('loginKey');
    navigation.reset({ index: 0, routes: [{ name: loginKey ? 'Dashboard' : 'MobileNumber' }] });
  };

  // Real Android applicationId, confirmed from android/app/build.gradle.
  // TODO: replace YOUR_APP_STORE_ID below with the real numeric App Store ID
  // once this app has an App Store Connect listing.
  const openStore = async () => {
    const androidStoreUrl = 'market://details?id=com.pygma';
    const androidWebUrl = 'https://play.google.com/store/apps/details?id=com.pygma';
    const iosStoreUrl = 'itms-apps://itunes.apple.com/app/idYOUR_APP_STORE_ID';
    const iosWebUrl = 'https://apps.apple.com/app/idYOUR_APP_STORE_ID';

    const primaryUrl = Platform.OS === 'android' ? androidStoreUrl : iosStoreUrl;
    const fallbackUrl = Platform.OS === 'android' ? androidWebUrl : iosWebUrl;

    try {
      const canOpenPrimary = await Linking.canOpenURL(primaryUrl);
      await Linking.openURL(canOpenPrimary ? primaryUrl : fallbackUrl);
    } catch (error) {
      await Linking.openURL(fallbackUrl);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await DatabaseService.initDatabase();
        setPrimaryColor(getPrimaryColor(await DatabaseService.getUser()));
        // Auth/verifyotp and Agent/getloggedagentdetail already return
        // AppConfigDetails. Prefer this persisted server response; only use
        // App/appconfig as a fallback before the first successful login.
        try {
          const storedConfig = await AsyncStorage.getItem('appConfig');
          let config = null;
          if (storedConfig) {
            try {
              config = JSON.parse(storedConfig);
            } catch (storedConfigError) {
              // A stale/corrupt cache must not suppress the version check.
            }
          }
          if (!config || typeof config !== 'object') {
            const configResponse = await ApiService.getAppConfig();
            config = typeof configResponse.data === 'string'
              ? JSON.parse(configResponse.data)
              : configResponse.data || {};
          }
          const installedVersion = Number(APP_VERSION_CODE);
          const currentVersion = Number(config.CurrentVersionId ?? config.currentVersionId);
          const minimumVersion = Number(config.MinVersionId ?? config.minVersionId);
          if (Number.isFinite(minimumVersion) && installedVersion < minimumVersion) {
            setUpdateInfo({ mandatory: true, versionName: config.MinVersionName ?? config.minVersionName ?? String(minimumVersion) });
            return;
          }
          if (Number.isFinite(currentVersion) && installedVersion < currentVersion) {
            setUpdateInfo({ mandatory: false, versionName: config.CurrentVersionName ?? config.currentVersionName ?? String(currentVersion) });
            return;
          }
        } catch (updateCheckError) {
          // A temporary offline/API failure must not prevent an existing user
          // from opening the app. Mandatory updates apply once config is read.
          console.log('App update check unavailable:', updateCheckError.message || updateCheckError);
        }
        await continueToApp();
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
      <PygmaLoader
        size={200}
        style={styles.logoImage}
      />
      {/* @string/tag_line, textSize=Heading2 (20sp) */}
      <Text style={[styles.tagline, { color: primaryColor }]}>Smart Collections... Smarter Growth</Text>
      <Modal visible={Boolean(updateInfo)} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.updateOverlay}>
          <View style={styles.updateCard}>
            <Text style={[styles.updateTitle, { color: primaryColor }]}>Update available</Text>
            <Text style={styles.updateMessage}>
              {updateInfo?.mandatory
                ? `Version ${updateInfo.versionName} is required to continue using Pygma.`
                : `A newer version (${updateInfo?.versionName}) of Pygma is available.`}
            </Text>
            <View style={styles.updateActions}>
              {!updateInfo?.mandatory && (
                <TouchableOpacity onPress={continueToApp} style={styles.laterButton}>
                  <Text style={[styles.laterText, { color: primaryColor }]}>Later</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={openStore} style={[styles.updateButton, { backgroundColor: primaryColor }]}>
                <Text style={styles.updateButtonText}>Update now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  tagline: {
    fontSize: UI_FONT.title,
    color: UI_COLORS.text,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  updateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  updateCard: { width: '100%', maxWidth: 420, backgroundColor: UI_COLORS.surface, borderRadius: 10, padding: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
  updateTitle: { fontSize: UI_FONT.title, fontWeight: '800' },
  updateMessage: { color: UI_COLORS.text, fontSize: UI_FONT.action, lineHeight: 23, marginTop: 12 },
  updateActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 24 },
  laterButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 10 },
  laterText: { fontSize: UI_FONT.action, fontWeight: '800' },
  updateButton: { minHeight: 42, borderRadius: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  updateButtonText: { color: UI_COLORS.surface, fontSize: UI_FONT.action, fontWeight: '800' },
});

export default SplashScreen;
