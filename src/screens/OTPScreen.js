import React, { useState, useEffect, useRef } from 'react';
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
  NativeEventEmitter,
  NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApiService from '../services/ApiService';
import DatabaseService from '../database/DatabaseService';
import LocationService from '../services/LocationService';
import OtpIllustration from '../assets/images/OtpIllustration';
import ErrorDialog from '../components/ErrorDialog';

// Matches fragment_otp.xml + OtpView.java exactly:
// title="Verify OTP" -> subTitle="We have sent a 6 digit OTP to {number}"
// -> ic_otp_image (250dp) -> OtpView: 6 EditTexts, gray border (otp_box.xml,
// 2dp stroke, 8dp radius), border turns colorPrimary blue on focus,
// auto-advances on digit entry, auto-backs on delete
// -> "Didn't receive OTP?" / "Resend OTP in Ns" countdown
// -> MaterialButtonRoundedCornersPrimary "Verify" (enabled only at 6 digits)
const OTPScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);
  const verificationInFlightRef = useRef(false);
  const lastAutoVerifiedOtpRef = useRef('');
  const { mobileNumber, otpId: initialOtpId } = route.params;
  const [otpId, setOtpId] = useState(initialOtpId);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !NativeModules.PygmaOtpRetriever) return undefined;
    const retriever = NativeModules.PygmaOtpRetriever;
    const emitter = new NativeEventEmitter(retriever);
    const subscription = emitter.addListener('PygmaOtpReceived', (code) => {
      const digits = String(code || '').replace(/\D/g, '').slice(0, 6);
      if (digits.length === 6) setOtp(digits.split(''));
    });
    retriever.startListening().catch((error) => {
      console.warn('SMS Retriever could not start:', error);
    });
    return () => {
      subscription.remove();
      retriever.stopListening();
    };
  }, []);

  const handleOtpChange = (text, index) => {
    const enteredDigits = text.replace(/[^0-9]/g, '');
    // iOS one-time-code AutoFill and a pasted Android code can provide all six
    // digits to the focused field in a single change event.
    if (enteredDigits.length > 1) {
      const completeCode = enteredDigits.slice(0, 6);
      setOtp([...completeCode.padEnd(6, '')]);
      if (completeCode.length === 6) Keyboard.dismiss();
      return;
    }
    const digit = enteredDigits.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (!digit && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const otpString = otp.join('');
  const isFormValid = otpString.length === 6;

  const handleVerifyOtp = async (codeOverride = null) => {
    const code = typeof codeOverride === 'string' ? codeOverride : otpString;
    if (code.length !== 6 || verificationInFlightRef.current) return;
    verificationInFlightRef.current = true;
    setIsLoading(true);
    try {
      console.log('OTP ID passed to verifyotp:', otpId);
      let location = {};
      try {
        location = await LocationService.getCurrentLocation();
      } catch (locationError) {
        // Android sends zero/empty location values when a location fix is not
        // yet available, so verification can still proceed.
      }
      const response = await ApiService.verifyOtp(mobileNumber, code, location, otpId);
      if (response.success || response.token) {
        // Auth/verifyotp returns LoginKey (stored by ApiService as loginKey),
        // not the legacy response.token field. Never pass undefined to
        // AsyncStorage, which throws on iOS.
        if (response.token) {
          await AsyncStorage.setItem('authToken', response.token);
        }
        try {
          const agentResponse = await ApiService.getAgentInfo();
          if (agentResponse.data) {
            await DatabaseService.insertUser(agentResponse.data);
          }
        } catch (e) {
          console.log('Agent details fetch ERROR:', e);
        }
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      } else {
        setErrorMessage(response.message || 'Failed to verify OTP');
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to verify OTP. Please try again.');
      setShowError(true);
    } finally {
      verificationInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isFormValid) {
      lastAutoVerifiedOtpRef.current = '';
      return;
    }
    if (lastAutoVerifiedOtpRef.current === otpString) return;
    lastAutoVerifiedOtpRef.current = otpString;
    const timeout = setTimeout(() => handleVerifyOtp(otpString), 300);
    return () => clearTimeout(timeout);
  }, [otpString, isFormValid, otpId]);

  const handleResendOtp = async () => {
    if (!canResend) return;
    setIsLoading(true);
    try {
      const appHashKey = Platform.OS === 'android'
        ? await NativeModules.PygmaOtpRetriever?.getAppHash().catch(() => '')
        : '';
      const response = await ApiService.sendOtp(mobileNumber, appHashKey || '');
      if (response.success && response.otpId !== null) {
        setOtpId(response.otpId);
        setOtp(['', '', '', '', '', '']);
        setResendTimer(60);
        setCanResend(false);
        inputRefs.current[0]?.focus();
        if (Platform.OS === 'android') {
          NativeModules.PygmaOtpRetriever?.startListening().catch(() => {});
        }
      } else if (response.success) {
        setErrorMessage('Could not start an OTP session. Please try again.');
        setShowError(true);
      } else {
        setErrorMessage(response.message || 'Failed to resend OTP');
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage('Failed to resend OTP');
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
        <Text style={styles.title}>Verify OTP</Text>

        {/* tvInfo */}
        <Text style={styles.subtitle}>We have sent a 6 digit OTP to {mobileNumber}</Text>

        {/* ivLogo - ic_otp_image, 250dp */}
        <View style={styles.logoBox}>
          <OtpIllustration width={250} />
        </View>

        {/* etOtp - OtpView: 6 EditTexts, gray border, blue on focus */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.otpInput,
                focusedIndex === index && styles.otpInputFocused,
              ]}
              maxLength={index === 0 ? 6 : 1}
              keyboardType="number-pad"
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={index === 0 ? (Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp') : 'off'}
              autoFocus={index === 0}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              editable={!isLoading}
            />
          ))}
        </View>

        {/* llResend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendInfo}>
            {canResend ? "Didn't receive OTP?" : `Resend OTP in ${resendTimer} seconds`}
          </Text>
          {canResend && (
            <TouchableOpacity onPress={handleResendOtp} disabled={isLoading}>
              <Text style={styles.resendAction}> Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* btnVerify */}
        <TouchableOpacity
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          onPress={() => handleVerifyOtp()}
          disabled={!isFormValid || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
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
  otpContainer: {
    flexDirection: 'row',
    marginTop: 22,
    marginBottom: 14,
  },
  otpInput: {
    flex: 1,
    height: 56,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#C8D4DE',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#17324D',
  },
  otpInputFocused: {
    borderColor: '#2874B2',
    backgroundColor: '#FFFFFF',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    flexWrap: 'wrap',
  },
  resendInfo: {
    fontSize: 14,
    color: '#506579',
  },
  resendAction: {
    fontSize: 14,
    color: '#2874B2',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#2874B2',
    borderRadius: 10,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
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

export default OTPScreen;
