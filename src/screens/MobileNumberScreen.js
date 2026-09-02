import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
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

// Matches fragment_mobile_number.xml exactly:
// title="Register" (TextBig=16sp) -> subTitle="Welcome to Pygma" (TextNormal=14sp, black)
// -> ic_welcome image (250dp, 30dp vertical margin) -> outlined TextInputLayout
// hint="Mobile Number" (phone, maxLength 10) -> MaterialCheckBox "I accept terms and conditions"
// -> MaterialButtonRoundedCornersPrimary "Send OTP" (enabled only when 10 digits + checked)
const MobileNumberScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [mobileNumber, setMobileNumber] = useState('');
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
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
          <Text style={styles.inputLabel}>Mobile Number</Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            maxLength={10}
            value={mobileNumber}
            onChangeText={setMobileNumber}
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
            <ActivityIndicator size="small" color="#FFFFFF" />
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#17324D',
    marginTop: 0,
  },
  subtitle: {
    fontSize: 16,
    color: '#657789',
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
  },
  inputLabel: {
    fontSize: 13,
    color: '#506579',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#C8D4DE',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#17324D',
    backgroundColor: '#F8FAFC',
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
    borderColor: '#2874B2',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#2874B2',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: 14,
    color: '#506579',
    flex: 1,
  },
  button: {
    backgroundColor: '#2874B2',
    borderRadius: 10,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MobileNumberScreen;
