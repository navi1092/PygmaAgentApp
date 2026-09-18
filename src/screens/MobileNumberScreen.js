import PygmaLoader from '../components/PygmaLoader';
import { UI_COLORS, UI_FONT } from '../utils/theme';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import uuid from 'react-native-uuid';
import ApiService from '../services/ApiService';
import LocationService from '../services/LocationService';
import WelcomeIllustration from '../assets/images/WelcomeIllustration';
import ErrorDialog from '../components/ErrorDialog';

// Authentication is shown before the user profile (and its API BackColor) is available.
const AUTH_PRIMARY_COLOR = '#2F7DB8';

// Matches fragment_mobile_number.xml exactly:
// title="Register" (TextBig=16sp) -> subTitle="Welcome to Pygma" (TextNormal=14sp, black)
// -> ic_welcome image (250dp, 30dp vertical margin) -> outlined TextInputLayout
// hint="Mobile Number" (phone, maxLength 10) -> MaterialCheckBox "I accept terms and conditions"
// -> MaterialButtonRoundedCornersPrimary "Send OTP" (enabled only when 10 digits + checked)
const MobileNumberScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [isMobileFocused, setIsMobileFocused] = useState(false);
  const [isTncChecked, setIsTncChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  const isFormValid = mobileNumber.length === 10 && isTncChecked;

  const handleSendOtp = async () => {
    if (!isFormValid) return;

    setIsLoading(true);
    try {
      try {
        await LocationService.requestLocationPermission();
      } catch (e) {}

      // Android registers the device first and passes its returned ID to the
      // OTP verification request. Use a generated, persisted installation ID
      // on iOS (there is no Android_ID equivalent available to React Native).
      let installationId = await AsyncStorage.getItem('deviceInstallationId');
      if (!installationId) {
        installationId = String(uuid.v4());
        await AsyncStorage.setItem('deviceInstallationId', installationId);
      }
      const registration = await ApiService.registerDevice(
        installationId,
        Platform.OS === 'ios' ? 'Pygma iOS Device' : 'Pygma React Native Device'
      );
      if (!registration.success || !registration.deviceId) {
        throw new Error(registration.message || 'Unable to register this device');
      }
      await AsyncStorage.setItem('deviceId', String(registration.deviceId));

      const appHashKey = Platform.OS === 'android'
        ? await NativeModules.PygmaOtpRetriever?.getAppHash().catch(() => '')
        : '';
      const response = await ApiService.sendOtp(mobileNumber, appHashKey || '');
      if (response.success && response.otpId !== null) {
        console.log('OTP ID received from getotp:', response.otpId);
        await AsyncStorage.setItem('userPhone', mobileNumber.trim());
        navigation.navigate('OTP', {
          mobileNumber: mobileNumber.trim(),
          otpId: response.otpId,
        });
      } else if (response.success) {
        setErrorMessage('Could not start an OTP session. Please request a new OTP.');
        setShowError(true);
      } else {
        setErrorMessage(response.message || 'Failed to send OTP');
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to send OTP. Please try again.');
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 32) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* tvTitle */}
        <Text style={styles.title}>Register</Text>

        {/* tvInfo */}
        <Text style={styles.subtitle}>Welcome to Pygma</Text>

        {/* ivLogo - ic_welcome, 250dp height - real converted artwork */}
        <View style={styles.logoBox}>
          <WelcomeIllustration width={250} />
        </View>

        {/* tilPhone - outlined text field, hint "Mobile Number" */}
        <View style={styles.inputWrapper}>
          <Text
            pointerEvents="none"
            style={[styles.inputLabel, (isMobileFocused || mobileNumber) && styles.inputLabelFloating]}
          >
            Mobile Number
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            maxLength={10}
            value={mobileNumber}
            onChangeText={setMobileNumber}
            onFocus={() => {
              setIsMobileFocused(true);
              setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
            }}
            onBlur={() => setIsMobileFocused(false)}
            editable={!isLoading}
          />
        </View>

        {/* chkTnC - MaterialCheckBox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setIsTncChecked(!isTncChecked)}
          disabled={isLoading}
        >
          <View style={[styles.checkbox, isTncChecked && styles.checkboxChecked]}>
            {isTncChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxText}>I accept terms and conditions</Text>
        </TouchableOpacity>

        {/* btnOtp - MaterialButtonRoundedCornersPrimary, disabled/alpha 0.5 until valid */}
        <TouchableOpacity
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={!isFormValid || isLoading}
        >
          {isLoading ? (
            <PygmaLoader size="small" />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      <ErrorDialog visible={showError} message={errorMessage} onClose={() => setShowError(false)} />
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_COLORS.inputBackground,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  title: {
    fontSize: UI_FONT.title,
    fontWeight: '800',
    color: AUTH_PRIMARY_COLOR,
    marginTop: 0,
  },
  subtitle: {
    fontSize: UI_FONT.action,
    color: UI_COLORS.text,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 8,
  },
  logoBox: {
    height: 190,
    marginVertical: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 90,
  },
  inputWrapper: {
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: UI_COLORS.search,
    borderRadius: 8,
    backgroundColor: UI_COLORS.surface,
  },
  inputLabel: {
    position: 'absolute',
    top: 15,
    left: 12,
    zIndex: 1,
    fontSize: UI_FONT.body,
    color: UI_COLORS.secondaryText,
    fontWeight: '800',
  },
  inputLabelFloating: {
    top: -10,
    left: 10,
    paddingHorizontal: 4,
    backgroundColor: UI_COLORS.surface,
    color: UI_COLORS.search,
    fontSize: UI_FONT.caption,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: UI_FONT.action,
    fontWeight: '400',
    color: UI_COLORS.text,
    backgroundColor: 'transparent',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    minHeight: 44,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: AUTH_PRIMARY_COLOR,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: AUTH_PRIMARY_COLOR,
  },
  checkmark: {
    color: UI_COLORS.surface,
    fontSize: UI_FONT.body,
    fontWeight: '800',
  },
  checkboxText: {
    fontSize: UI_FONT.body,
    color: UI_COLORS.text,
    fontWeight: '800',
    flex: 1,
  },
  button: {
    backgroundColor: AUTH_PRIMARY_COLOR,
    borderRadius: 10,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: AUTH_PRIMARY_COLOR,
    opacity: 0.5,
  },
  buttonText: {
    color: UI_COLORS.surface,
    fontSize: UI_FONT.action,
    fontWeight: '800',
  },
});

export default MobileNumberScreen;
