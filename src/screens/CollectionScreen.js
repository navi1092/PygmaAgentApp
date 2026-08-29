import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  ScrollView,
  useWindowDimensions,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
  TouchableWithoutFeedback,
  PermissionsAndroid,
  NativeModules,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApiService from '../services/ApiService';
import DatabaseService from '../database/DatabaseService';
import LocationService from '../services/LocationService';
import ConnectivityService from '../services/ConnectivityService';
import BluetoothService from '../services/BluetoothService';
import PrintIcon from '../assets/images/PrintIcon';
import WhatsAppIcon from '../assets/images/WhatsAppIcon';
import ReceiptService from '../services/ReceiptService';
import Share from 'react-native-share';
import Svg, { Path } from 'react-native-svg';
import { selectContactPhone } from 'react-native-select-contact';

const collectionIconPaths = {
  dashboard: 'M520 360V120h320v240H520ZM120 520V120h320v400H120ZM520 840V440h320v400H520ZM120 840V600h320v240H120ZM200 440h160V200H200v240ZM600 760h160V520H600v240ZM600 280h160v-80H600v80ZM200 760h160v-80H200v80Z',
  search: 'M824 880 716 772q-22 13-46 20.5t-50 7.5q-75 0-127.5-52.5T440 620q0-75 52.5-127.5T620 440q75 0 127.5 52.5T800 620q0 26-7.5 50T772 716l108 108-56 56ZM620 720q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29ZM840 400h-80V200h-80v120H280V200h-80v560h200v80H200q-33 0-56.5-23.5T120 760V200q0-33 23.5-56.5T200 120h167q11-35 43-57.5T480 40q40 0 71.5 22.5T594 120h166q33 0 56.5 23.5T840 200v200ZM480 200q17 0 28.5-11.5T520 160q0-17-11.5-28.5T480 120q-17 0-28.5 11.5T440 160q0 17 11.5 28.5T480 200Z',
  previous: 'M440 720 200 480l240-240 56 56-183 184 183 184-56 56ZM704 720 464 480l240-240 56 56-183 184 183 184-56 56Z',
  next: 'M383 480 200 296l56-56 240 240-240 240-56-56 183-184ZM647 480 464 296l56-56 240 240-240 240-56-56 183-184Z',
};

const CollectionIcon = ({ name, size, color, style }) => (
  name === 'location' ? (
    <Svg width={size} height={size} viewBox="0 0 64 64" style={style} accessibilityRole="image">
      <Path d="M32 0C18.745 0 8 10.745 8 24c0 5.678 2.502 10.671 5.271 15l17.097 24.156C30.743 63.686 31.352 64 32 64s1.257-.314 1.632-.844L50.729 39C53.375 35.438 56 29.678 56 24 56 10.745 45.255 0 32 0ZM48.087 39h-.01L32 61 15.923 39h-.01C13.469 35.469 10 29.799 10 24c0-12.15 9.85-22 22-22s22 9.85 22 22c0 5.799-3.719 11.781-5.913 15Z" fill="#394240" />
      <Path d="M32 14c-5.523 0-10 4.478-10 10s4.477 10 10 10 10-4.478 10-10-4.477-10-10-10Zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8Z" fill="#394240" />
      <Path d="M32 10c-7.732 0-14 6.268-14 14s6.268 14 14 14 14-6.268 14-14-6.268-14-14-14Zm0 26c-6.627 0-12-5.373-12-12s5.373-12 12-12 12 5.373 12 12-5.373 12-12 12Z" fill="#394240" />
      <Path d="M32 12c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12Zm0 22c-5.522 0-10-4.477-10-10s4.478-10 10-10 10 4.477 10 10-4.478 10-10 10Z" fill="#F76D57" />
      <Path d="M32 2c-12.15 0-22 9.85-22 22 0 5.799 3.469 11.469 5.913 15h.01L32 61l16.077-22h.01C50.281 35.781 54 29.799 54 24 54 11.85 44.15 2 32 2Zm0 36c-7.732 0-14-6.268-14-14s6.268-14 14-14 14 6.268 14 14-6.268 14-14 14Z" fill="#F76D57" />
      <Path d="M32 12c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12Zm0 22c-5.522 0-10-4.477-10-10s4.478-10 10-10 10 4.477 10 10-4.478 10-10 10Z" fill="#231F20" fillOpacity={0.2} />
    </Svg>
  ) : (
    <Svg width={size} height={size} viewBox="0 0 960 960" style={style} accessibilityRole="image">
      <Path d={collectionIconPaths[name]} fill={color} />
    </Svg>
  )
);

const CollectionScreen = ({ navigation, route }) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = screenWidth < 390;
  const contentPadding = screenWidth >= 500 ? 42 : 20;
  const [accounts, setAccounts] = useState([]);
  const [user, setUser] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const screenScrollRef = useRef(null);
  const isContactPickerOpenRef = useRef(false);
  const [amountError, setAmountError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [showAccountList, setShowAccountList] = useState(false);
  const [filterMode, setFilterMode] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({ totalAmount: 0, uploaded: 0, pending: 0 });
  const [syncProgress, setSyncProgress] = useState({ uploaded: 0, total: 0, pending: 0 });
  const [validation, setValidation] = useState(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [openWhatsAppAfterPhoneUpdate, setOpenWhatsAppAfterPhoneUpdate] = useState(false);
  const [isSelectingContact, setIsSelectingContact] = useState(false);
  const [isPhoneKeyboardVisible, setIsPhoneKeyboardVisible] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const [receiptTransactions, setReceiptTransactions] = useState([]);
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [printerDevices, setPrinterDevices] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    loadAccounts();
    if (Platform.OS === 'android') BluetoothService.requestBluetoothPermission().catch(() => {});
    return ConnectivityService.subscribe(async () => {
      await refreshSyncProgress();
      setReceiptTransactions(await DatabaseService.getTransactions());
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setIsPhoneKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setIsPhoneKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const loadAccounts = async () => {
    try {
      setUser(await DatabaseService.getUser());
      let list = await DatabaseService.getAccounts();
      if (route.params?.account) {
        const idx = list.findIndex((a) => a.AccountId === route.params.account.AccountId);
        setCurrentIndex(idx >= 0 ? idx : 0);
      }
      setAccounts(list);
      setValidation(await DatabaseService.getLatestValidation());
      await refreshSyncProgress();
    } catch (error) {
      console.log('Error loading accounts:', error);
    }
  };

  const refreshSyncProgress = async () => {
    await DatabaseService.migrateLegacyTransactionSyncStates();
    const transactions = await DatabaseService.getTransactions();
    const pending = transactions.filter((transaction) =>
      Number(transaction.syncStatus ?? transaction.SyncStatus) === 0
    ).length;
    setSyncProgress({
      total: transactions.length,
      pending,
      uploaded: Math.max(transactions.length - pending, 0),
    });
  };

  const visibleAccounts = accounts.filter((account) => {
    const collected = Number(account.lastCollectedAmt) > 0;
    if (accountFilter === 'collected') return collected;
    if (accountFilter === 'pending') return !collected;
    return true;
  });
  const currentAccount = visibleAccounts[currentIndex] || null;

  const getAccountDefaultAmount = (account) => {
    const agreedAmount = Number(account?.AgreedAmount ?? account?.agreedAmount);
    return Number.isFinite(agreedAmount) ? agreedAmount.toFixed(2) : '';
  };

  const getCollectedTotal = () => accounts.reduce(
    (total, account) => total + (Number(account.lastCollectedAmt) || 0),
    0
  );

  const getMaximumAmount = () => {
    const value = Number(validation?.MaximumAmount ?? validation?.maximumAmount);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };

  const getRemainingAllowedAmount = () => {
    const maximumAmount = getMaximumAmount();
    return maximumAmount === null ? null : Math.max(maximumAmount - getCollectedTotal(), 0);
  };

  useEffect(() => {
    if (!currentAccount || receiptNumber) return;
    const defaultAmount = getAccountDefaultAmount(currentAccount);
    const defaultValue = Number(defaultAmount);
    const remainingAmount = getRemainingAllowedAmount();
    setAmount(defaultAmount);
    if (remainingAmount !== null && Number.isFinite(defaultValue) && defaultValue > remainingAmount) {
      setAmountError(`You can collect upto ₹${remainingAmount.toFixed(2)}`);
    } else {
      setAmountError('');
    }
  }, [currentAccount?.AccountId, receiptNumber, validation, accounts]);

  const selectAccountFilter = (nextFilter) => {
    setAccountFilter(nextFilter);
    setFilterMode(nextFilter === 'pending' ? 'uncollected' : nextFilter);
    setShowAccountList(true);
    setCurrentIndex(0);
    setReceiptNumber('');
    setAmount('');
    setAmountError('');
  };

  const validateAmount = (value) => {
    if (!value.trim()) {
      setAmountError('Amount cannot be empty');
      return false;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setAmountError('Invalid number');
      return false;
    }
    if (numValue <= 0) {
      setAmountError('Amount must be greater than 0');
      return false;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      setAmountError('Max 2 decimal places allowed');
      return false;
    }

    const remainingAmount = getRemainingAllowedAmount();
    if (remainingAmount !== null && numValue > remainingAmount) {
      setAmountError(`You can collect upto ₹${remainingAmount.toFixed(2)}`);
      return false;
    }
    setAmountError('');
    return true;
  };

  const canCollect = (requestedAmount = 0) => {
    if (!validation) return true;
    const startDate = validation.StartDate ?? validation.startDate;
    const endDate = validation.EndDate ?? validation.endDate;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    const now = new Date();
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))
      || (start && now < start) || (end && now > end)) {
      setAmountError('Current time is not allowed to make new receipts');
      return false;
    }

    const maximumAmount = getMaximumAmount();
    const collectedTotal = getCollectedTotal();
    if (maximumAmount !== null && collectedTotal >= maximumAmount) {
      setAmountError(`No more receipts allowed. The maximum allowed is ₹${maximumAmount.toFixed(2)}`);
      return false;
    }

    if (maximumAmount !== null && collectedTotal + requestedAmount > maximumAmount) {
      setAmountError(`You can collect upto ₹${Math.max(maximumAmount - collectedTotal, 0).toFixed(2)}`);
      return false;
    }

    const maxReceipts = Number(validation.MaxReceiptsCount ?? validation.maxReceiptsCount);
    if (Number.isFinite(maxReceipts) && maxReceipts > 0 && Number(currentAccount?.collectionCount || 0) >= maxReceipts) {
      setAmountError(`This account reached the maximum (${maxReceipts} per account) allowed receipts`);
      return false;
    }
    return true;
  };

  const handleAmountChange = (value) => {
    setAmount(value);
    if (value.trim()) validateAmount(value);
    else setAmountError('');
  };

  const amountStep = Math.max(Number(currentAccount?.AgreedAmount) || 100, 0.01);
  const adjustAmount = (direction) => {
    const current = Number.parseFloat(amount) || 0;
    const next = direction > 0
      ? current + amountStep
      : Math.max(0, current - amountStep);
    const formatted = next.toFixed(2);

    const remainingAmount = getRemainingAllowedAmount();
    if (direction > 0 && remainingAmount !== null && next > remainingAmount) {
      setAmountError(`You can collect upto ₹${remainingAmount.toFixed(2)}`);
      return;
    }
    setAmount(formatted);
    if (next > 0) validateAmount(formatted);
    else setAmountError('Amount must be greater than 0');
  };

  const handleCollect = async () => {
    if (!currentAccount) {
      Alert.alert('Error', 'No account selected');
      return;
    }
    if (!validateAmount(amount)) return;
    if (!canCollect(parseFloat(amount))) return;

    setIsLoading(true);
    try {
      let location = null;
      try {
        const hasLocationPermission = await LocationService.requestLocationPermission();
        if (hasLocationPermission) location = await LocationService.getCurrentLocation();
      } catch (error) {
        console.log('Collection location unavailable:', error.message || error);
      }

      const transactionNumbers = await DatabaseService.getNextTransactionNumbers(validation);
      const collectedAmount = parseFloat(amount);

      const collectionData = {
        TransactionId: String(transactionNumbers.tranNumber),
        tranNumber: transactionNumbers.tranNumber,
        datewiseTranNumber: transactionNumbers.datewiseTranNumber,
        tranDate: new Date().toISOString(),
        accountID: currentAccount.AccountId,
        accountName: currentAccount.AccountName || '',
        accountNumber: currentAccount.AccountNumber || '',
        amount: collectedAmount,
        locationX: location?.latitude || 0,
        locationY: location?.longitude || 0,
        locationName: location?.locationName || '',
        balanceAmount: (Number(currentAccount.BalanceAmount) || 0) + collectedAmount,
        balanceDate: new Date().toISOString(),
        openingBalance: Number(currentAccount.BalanceAmount) || 0,
        syncStatus: 0,
        tranRemarks: '',
        AccountId: currentAccount.AccountId,
        Amount: collectedAmount,
      };

      const receiptNum = `${collectionData.tranNumber}`;
      await ApiService.queueTransactionUpload({
        ...collectionData,
        ReceiptNumber: receiptNum,
        TransactionDate: collectionData.tranDate,
      });
      await DatabaseService.markAccountCollected(
        currentAccount.AccountId,
        collectedAmount,
        receiptNum
      );
      setReceiptNumber(receiptNum);
      setAccounts((current) => current.map((account) =>
        account.AccountId === currentAccount.AccountId
          ? { ...account, collectionCount: (Number(account.collectionCount) || 0) + 1, BalanceAmount: (Number(account.BalanceAmount) || 0) + collectedAmount, lastCollectedAmt: (Number(account.lastCollectedAmt) || 0) + collectedAmount, lastReceipt: receiptNum }
          : account
      ));

      const syncResult = await ApiService.syncOfflineQueue();
      await refreshSyncProgress();
      setSummary((s) => ({
        ...s,
        totalAmount: s.totalAmount + collectedAmount,
        uploaded: s.uploaded + syncResult.uploaded,
        pending: syncResult.remaining,
      }));

      setAmount('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Collection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollectAgain = () => {
    setReceiptNumber('');
    setAmount(getAccountDefaultAmount(currentAccount));
    setAmountError('');
  };

  const handleViewReceipts = async () => {
    const transactions = await DatabaseService.getTransactions();
    if (!transactions.length) {
      Alert.alert('Receipts', 'No Transactions found');
      return;
    }
    setReceiptTransactions(transactions);
    setShowReceipts(true);

    ApiService.syncOfflineQueue()
      .then(async () => {
        setReceiptTransactions(await DatabaseService.getTransactions());
        await refreshSyncProgress();
      })
      .catch(() => {});
  };

  const openPhoneEditor = (continueToWhatsApp = false) => {
    setOpenWhatsAppAfterPhoneUpdate(continueToWhatsApp);
    setPhoneNumber(currentAccount?.MobileNumber || '');
    setShowPhoneModal(true);
  };

  const handleSelectContact = async () => {
    if (isContactPickerOpenRef.current) return;

    isContactPickerOpenRef.current = true;
    Keyboard.dismiss();
    setIsSelectingContact(true);
    try {
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Contacts permission is required to choose a phone number.');
        }
      }

      const selectedNumber = Platform.OS === 'ios'
        ? await NativeModules.PygmaContactPicker.selectPhone()
        : (await selectContactPhone())?.selectedPhone?.number;
      if (!selectedNumber) return;

      const number = String(selectedNumber)
        .replace(/\D/g, '')
        .slice(-10);
      if (number.length !== 10) {
        throw new Error('This contact does not have a valid 10 digit mobile number.');
      }
      setPhoneNumber(number);
    } catch (error) {
      Alert.alert('Contacts', error.message || 'Unable to load contacts.');
    } finally {
      isContactPickerOpenRef.current = false;
      setIsSelectingContact(false);
    }
  };

  const getReceiptPayload = async () => ({
    user,
    account: currentAccount,
    transactions: await DatabaseService.getTransactions(currentAccount?.AccountId),
  });

  const handlePrint = async () => {
    if (!currentAccount) return;
    setIsPrinting(true);
    try {
      const bluetoothAllowed = await BluetoothService.requestBluetoothPermission();
      if (!bluetoothAllowed) {
        throw new Error('Bluetooth access is required to connect a receipt printer. Allow it in Settings and try again.');
      }
      const result = await ReceiptService.printReceipt(await getReceiptPayload());
      if (result.needsPrinterSelection) {
        if (!result.devices.length) {
          throw new Error('No compatible Bluetooth printer was found. Turn on and connect an iPhone-compatible receipt printer, then try again.');
        }
        setPrinterDevices(result.devices);
        setShowPrinterPicker(true);
      }
    } catch (error) {
      Alert.alert('Print', error.message || 'Unable to print the receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSelectPrinter = async (printerAddress) => {
    setShowPrinterPicker(false);
    setIsPrinting(true);
    try {
      await ReceiptService.printWithSelectedPrinter(printerAddress, await getReceiptPayload());
    } catch (error) {
      Alert.alert('Print', error.message || 'Unable to print the receipt.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleWhatsAppReceipt = async (phoneOverride = null) => {
    if (!currentAccount) return;
    const getScalarValue = (value, preferredKeys = []) => {
      if (value === null || value === undefined) return '';
      if (typeof value !== 'object') return String(value).trim();
      for (const key of preferredKeys) {
        if (value[key] !== undefined && value[key] !== null && String(value[key]).trim()) {
          return getScalarValue(value[key], preferredKeys);
        }
      }
      const firstValue = Object.values(value).find((item) => item !== null && item !== undefined);
      return firstValue === undefined ? '' : getScalarValue(firstValue, preferredKeys);
    };
    const mobileNumber = getScalarValue(
      phoneOverride || currentAccount.MobileNumber || currentAccount.mobileNumber,
      ['MobileNumber', 'mobileNumber', 'PhoneNumber', 'phoneNumber', 'number', 'value']
    );
    if (!mobileNumber) {
      openPhoneEditor(true);
      return;
    }
    try {
      const transactions = await DatabaseService.getTransactions(currentAccount.AccountId);
      if (!transactions.length) throw new Error('Unable to fetch details');
      const tranNumbers = transactions
        .map((transaction) => transaction.tranNumber ?? transaction.TranNumber ?? transaction.ReceiptNumber)
        .filter(Boolean)
        .join(',');
      const template = getScalarValue(user?.WAURL, ['WAURL', 'waurl', 'url', 'value']);
      if (!template) throw new Error('WhatsApp receipt link is not configured for this society.');
      const url = (template.startsWith('http://') || template.startsWith('https://') ? template : `https://${template}`)
        .replace(/<<PhoneNumber>>/g, mobileNumber)
        .replace(/<<LID>>/g, '1')
        .replace(/<<BID>>/g, String(user?.BankID || ''))
        .replace(/<<AID>>/g, String(currentAccount.AccountId || ''))
        .replace(/<<TNO>>/g, tranNumbers)
        .replace(/<<AGID>>/g, String(user?.AgentID || ''));
      if (/\[object object\]/i.test(url) || !/^https?:\/\//i.test(url)) {
        throw new Error('The WhatsApp receipt link is invalid. Please contact support.');
      }
      console.log('WhatsApp receipt URL', {
        accountId: currentAccount.AccountId,
        mobileNumber,
        waurl: template,
        url,
      });
      try {
        await Linking.openURL(url);
      } catch (openError) {
        if (/cancel/i.test(String(openError?.message || ''))) throw openError;
        await Share.shareSingle({ social: Share.Social.WHATSAPP, url });
      }
    } catch (error) {
      const message = String(error?.message || '');
      if (!/cancel/i.test(message)) {
        Alert.alert('WhatsApp', message || 'WhatsApp is not installed or could not be opened on this device.');
      }
    }
  };

  const handleUpdatePhoneNumber = async () => {
    const number = phoneNumber.trim();
    if (!/^\d{10}$/.test(number)) {
      Alert.alert('Invalid number', 'Enter a valid 10 digit mobile number.');
      return;
    }
    setIsUpdatingPhone(true);
    try {
      const response = await ApiService.updatePhoneNumber({
        MobileNumber: number,
        AccountID: currentAccount.AccountId,
      });
      if (!response.success) throw new Error(response.message || 'Unable to update phone number');
      await DatabaseService.updateAccountMobileNumber(currentAccount.AccountId, number);
      setAccounts((current) => current.map((account) =>
        account.AccountId === currentAccount.AccountId ? { ...account, MobileNumber: number } : account
      ));
      setShowPhoneModal(false);
      if (openWhatsAppAfterPhoneUpdate) {
        setOpenWhatsAppAfterPhoneUpdate(false);
        setTimeout(() => handleWhatsAppReceipt(number), 300);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to update phone number');
    } finally {
      setIsUpdatingPhone(false);
    }
  };

  const handleOpenDirections = async () => {
    const getCoordinate = (...values) => values
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value !== 0);
    const latitude = getCoordinate(
      currentAccount?.locationX,
      currentAccount?.LocationX,
      currentAccount?.latitude,
      currentAccount?.Latitude,
      currentAccount?.LocationLatitude
    );
    const longitude = getCoordinate(
      currentAccount?.locationY,
      currentAccount?.LocationY,
      currentAccount?.longitude,
      currentAccount?.Longitude,
      currentAccount?.LocationLongitude
    );
    let destinationLatitude = latitude;
    let destinationLongitude = longitude;
    if (destinationLatitude === undefined || destinationLongitude === undefined) {
      try {
        const hasLocationPermission = await LocationService.requestLocationPermission();
        if (!hasLocationPermission) {
          Alert.alert('Location permission required', 'Allow location access to open your current location.');
          return;
        }
        const currentLocation = await LocationService.getCurrentLocation();
        destinationLatitude = Number(currentLocation.latitude);
        destinationLongitude = Number(currentLocation.longitude);
        if (!Number.isFinite(destinationLatitude) || !Number.isFinite(destinationLongitude)) {
          throw new Error('Invalid current location');
        }
      } catch (error) {
        Alert.alert('Location unavailable', 'Unable to fetch your current location. Please check location services and try again.');
        return;
      }
    }
    try {
      const directionsUrl = Platform.OS === 'ios'
        ? `https://maps.apple.com/?ll=${destinationLatitude},${destinationLongitude}&q=Current%20Location`
        : `https://www.google.com/maps/search/?api=1&query=${destinationLatitude},${destinationLongitude}`;
      await Linking.openURL(directionsUrl);
    } catch (error) {
      try {
        await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${destinationLatitude},${destinationLongitude}`);
      } catch (fallbackError) {
        Alert.alert('Location unavailable', 'Unable to open directions on this device.');
      }
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setReceiptNumber('');
      setAmount('');
      setAmountError('');
    }
  };

  const goToNext = () => {
    if (currentIndex < visibleAccounts.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setReceiptNumber('');
      setAmount('');
      setAmountError('');
    }
  };

  const handleSelectFromList = (index) => {
    const visibleIndex = visibleAccounts.findIndex((account) => account.AccountId === accounts[index]?.AccountId);
    setCurrentIndex(visibleIndex >= 0 ? visibleIndex : 0);
    setShowAccountList(false);
    setReceiptNumber('');
    setAmount('');
    setAmountError('');
  };

  const filteredAccounts = accounts
    .map((a, idx) => ({ ...a, _idx: idx }))
    .filter((a) => {
      if (filterMode === 'uncollected' && Number(a.lastCollectedAmt) > 0) return false;
      if (filterMode === 'collected' && Number(a.lastCollectedAmt) <= 0) return false;
      if (searchQuery && !a.AccountName?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });

  const renderAccountListItem = ({ item }) => (
    <TouchableOpacity
      style={styles.accountListItem}
      onPress={() => handleSelectFromList(item._idx)}
    >
      <Text style={styles.accountListName}>{item.AccountName}</Text>
      <Text style={styles.accountListSub}>Account:{item.AccountNumber}</Text>
      <Text style={styles.accountListSub}>Contact:{item.MobileNumber}</Text>
    </TouchableOpacity>
  );

  if (!currentAccount) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#7F7BF4" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')}>
            <Text style={styles.headerLink}>Dashboard</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{accounts.length ? `No ${accountFilter} accounts.` : 'No accounts downloaded yet.'}</Text>
          <Text style={styles.emptyText}>{accounts.length ? 'Choose another status above.' : 'Go to Dashboard and tap Download.'}</Text>
        </View>
        <TouchableOpacity style={styles.dashboardFooterButton} onPress={() => navigation.navigate('Dashboard')}>
          <CollectionIcon name="dashboard" size={26} color="#7F7BF4" style={styles.dashboardFooterIcon} />
          <Text style={styles.dashboardFooterText}>Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <LinearGradient
        colors={['#2874B2', '#EAF2F7', '#FFFFFF']}
        locations={[0, 0.28, 0.7]}
        style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 10) }]}
      >
      <StatusBar barStyle="light-content" backgroundColor="#7F7BF4" />

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        ref={screenScrollRef}
        style={styles.screenContent}
        contentContainerStyle={[styles.screenContentContainer, { paddingHorizontal: contentPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* lblTranSummary "Current Collection" */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{user?.BankName || user?.BankShortName || 'Society'}</Text>
          <View style={styles.summaryCountsRow}>
            <TouchableOpacity style={[styles.summaryBox, accountFilter === 'all' && styles.summaryBoxActive]} onPress={() => selectAccountFilter('all')}>
              <Text style={styles.summaryCountValue}>{accounts.length}</Text>
              <Text style={styles.summaryCountLabel}>Total</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.summaryCountItem, accountFilter === 'collected' && styles.summaryBoxActive]} onPress={() => selectAccountFilter('collected')}>
              <Text style={styles.summaryCountValue}>{accounts.filter((account) => Number(account.lastCollectedAmt) > 0).length}</Text>
              <Text style={styles.summaryCountLabel}>Collected</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.summaryCountItem, accountFilter === 'pending' && styles.summaryBoxActive]} onPress={() => selectAccountFilter('pending')}>
              <Text style={[styles.summaryCountValue, { color: '#FF9800' }]}>
                {Math.max(accounts.length - accounts.filter((account) => Number(account.lastCollectedAmt) > 0).length, 0)}
              </Text>
              <Text style={styles.summaryCountLabel}>Pending</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionPills}>
          <TouchableOpacity style={[styles.dashboardFooterButton, isCompact && styles.dashboardFooterButtonCompact]} onPress={() => navigation.navigate('Dashboard')}>
            <CollectionIcon name="dashboard" size={30} color="#7F7BF4" style={styles.dashboardFooterIcon} />
            <Text style={styles.dashboardFooterText}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.positionPill, isCompact && styles.positionPillCompact]}
            onPress={handleViewReceipts}
            disabled={isLoading}
            accessibilityLabel="View receipts and sync pending collections"
          >
            <Text style={styles.uploadIcon}>⇧</Text>
            <Text style={styles.positionPillText}>{accounts.filter((account) => Number(account.lastCollectedAmt) > 0).length}/{accounts.length}</Text>
          </TouchableOpacity>
        </View>

        {/* Account details and collection action */}
        <View style={styles.card}>
          <View style={styles.accountHeader}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(currentAccount.AccountName)}</Text></View>
            <View style={styles.accountTitleBlock}>
              <Text style={styles.accountName}>{currentAccount.AccountName}</Text>
              <TouchableOpacity onPress={openPhoneEditor} disabled={isLoading}>
                <Text style={styles.phoneLink}>{currentAccount.MobileNumber || 'Add Phone Number'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handlePrint} disabled={isPrinting} accessibilityLabel="Print account receipt">
              <PrintIcon size={45} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.locationButton} onPress={handleOpenDirections} accessibilityLabel="Open account location in maps">
              <CollectionIcon name="location" size={42} color="#E66754" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsGrid}>
            <DetailRow label="Account Number" value={currentAccount.AccountNumber || '-'} />
            <DetailRow right label="Balance" value={`₹${Number(currentAccount.BalanceAmount || 0).toFixed(2)}`} />
            {currentAccount.LeanAccountNumber ? (
              <>
                <DetailRow label="Lean Account Number" value={currentAccount.LeanAccountNumber} />
                <DetailRow right label="Lean Amount" value={`₹${Number(currentAccount.LeanAmount || 0).toFixed(2)}`} />
              </>
            ) : null}
            <DetailRow label="Opening Date" value={formatDate(currentAccount.OpeningDate)} />
            <DetailRow right label="Last Collection Date" value={formatDate(currentAccount.LastTranDate)} />
            <View style={styles.schemeCell}>
              <Text style={styles.detailValue}>{`${currentAccount.SchemeCode ? `(${currentAccount.SchemeCode}) ` : ''}${currentAccount.SchemeName || '-'}`}</Text>
              <Text style={styles.detailLabel}>Scheme</Text>
            </View>
          </View>

          {receiptNumber ? (
            <View style={styles.receiptSection}>
              <Text style={styles.successText}>✿ ₹{Number(currentAccount.lastCollectedAmt || amount || 0).toFixed(2)} is collected</Text>
              <Text style={styles.receiptNumber}>Receipt #{receiptNumber}</Text>
              <View style={styles.receiptAction}>
                <TouchableOpacity style={styles.printAction} onPress={handlePrint} disabled={isPrinting}>
                  <Text style={styles.printActionText}>Print</Text>
                  <PrintIcon size={43} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.whatsappAction} onPress={() => handleWhatsAppReceipt()} accessibilityLabel="Send receipt by WhatsApp">
                  <WhatsAppIcon size={48} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.collectionSection}>
              <View style={styles.amountControlRow}>
                <TouchableOpacity
                  style={styles.amountAdjustButton}
                  onPress={() => adjustAmount(-1)}
                  disabled={isLoading}
                  accessibilityLabel="Decrease amount"
                >
                  <Text style={styles.amountAdjustText}>−</Text>
                </TouchableOpacity>
                <View style={[styles.amountField, (amountFocused || amount) && styles.amountFieldHighlighted, amountError && styles.amountInputError]}>
                  <Text style={styles.amountFloatingLabel}>Amount</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={[styles.currencyPrefix, (amountFocused || amount) && styles.currencyPrefixHighlighted]}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      placeholderTextColor="#9AAAB7"
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={handleAmountChange}
                      onFocus={() => {
                        setAmountFocused(true);
                        setTimeout(() => screenScrollRef.current?.scrollToEnd({ animated: true }), 120);
                      }}
                      onBlur={() => setAmountFocused(false)}
                      editable={!isLoading}
                    />
                  </View>
                  {!!amountError && <Text style={styles.amountErrorIcon}>!</Text>}
                </View>
                <TouchableOpacity
                  style={styles.amountAdjustButton}
                  onPress={() => adjustAmount(1)}
                  disabled={isLoading}
                  accessibilityLabel="Increase amount"
                >
                  <Text style={styles.amountAdjustText}>+</Text>
                </TouchableOpacity>
              </View>
              {!!amountError && <Text style={styles.errorText}>{amountError}</Text>}
              <TouchableOpacity
                style={[styles.primaryButton, (!amount || !!amountError) && styles.buttonDisabled]}
                onPress={handleCollect}
                disabled={!amount || !!amountError || isLoading}
              >
                {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Collect</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.referenceBottomNav}>
        <TouchableOpacity onPress={goToPrevious} disabled={currentIndex === 0} style={styles.referenceNavItem}>
          <CollectionIcon name="previous" size={31} color="#111111" style={[styles.referenceNavIcon, currentIndex === 0 && styles.navButtonDisabled]} />
          <Text style={styles.referenceNavLabel}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowAccountList(true)} style={styles.referenceNavItem}>
          <CollectionIcon name="search" size={31} color="#111111" style={styles.referenceNavIcon} />
          <Text style={styles.referenceNavLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNext} disabled={currentIndex >= visibleAccounts.length - 1} style={styles.referenceNavItem}>
          <CollectionIcon name="next" size={31} color="#111111" style={[styles.referenceNavIcon, currentIndex >= visibleAccounts.length - 1 && styles.navButtonDisabled]} />
          <Text style={styles.referenceNavLabel}>Next</Text>
        </TouchableOpacity>
      </View>

      {/* Account list bottom sheet - Search / View All / Uncollected */}
      <Modal
        visible={showAccountList}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAccountList(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {filterMode === 'uncollected' ? 'Uncollected Accounts' : filterMode === 'collected' ? 'Collected Accounts' : 'All Accounts'}
              </Text>
              <Text style={styles.modalSubtitle}>Select an account to view details</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButtonTouchTarget}
              onPress={() => setShowAccountList(false)}
              accessibilityLabel="Close account list"
            >
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterButton, filterMode === 'all' && styles.filterButtonActive]}
              onPress={() => setFilterMode('all')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterMode === 'all' && styles.filterButtonTextActive,
                ]}
              >
                View All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterMode === 'uncollected' && styles.filterButtonActive,
              ]}
              onPress={() => setFilterMode('uncollected')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterMode === 'uncollected' && styles.filterButtonTextActive,
                ]}
              >
                Uncollected
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredAccounts}
            renderItem={renderAccountListItem}
            keyExtractor={(item) => item.AccountId?.toString()}
            contentContainerStyle={styles.modalList}
          />
        </View>
      </Modal>

      {/* Android TransactionsBottomSheet: opened by the upload/receipt pill. */}
      <Modal visible={showReceipts} transparent animationType="slide" onRequestClose={() => setShowReceipts(false)}>
        <View style={styles.receiptsOverlay}>
          <View style={styles.receiptsSheet}>
            <View style={styles.receiptsSheetHeader}>
              <Text style={styles.receiptsSheetTitle}>Receipts</Text>
              <TouchableOpacity style={styles.receiptsCloseButton} onPress={() => setShowReceipts(false)} accessibilityLabel="Close receipts">
                <Text style={styles.receiptsClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={receiptTransactions}
              keyExtractor={(item, index) => String(item.TransactionId ?? item.transactionId ?? index)}
              contentContainerStyle={styles.receiptsList}
              renderItem={({ item }) => {
                const linkedAccount = accounts.find((account) => String(account.AccountId) === String(item.AccountId ?? item.accountID ?? item.accountId));
                const uploaded = Number(item.syncStatus ?? item.SyncStatus) === 1;
                const receipt = item.tranNumber ?? item.TranNumber ?? item.ReceiptNumber ?? item.receiptNumber ?? item.TransactionId;
                const accountName = item.accountName ?? item.AccountName ?? linkedAccount?.AccountName ?? '-';
                const accountNumber = item.accountNumber ?? item.AccountNumber ?? linkedAccount?.AccountNumber ?? '-';
                const transactionDate = item.tranDate ?? item.TransactionDate;
                const remarks = item.tranRemarks ?? item.TranRemarks;
                return (
                  <View style={styles.receiptListCard}>
                    <View style={styles.receiptListTopRow}>
                      <Text style={styles.receiptListMeta}>Receipt #{receipt}</Text>
                      <Text style={styles.receiptListMeta}>{formatReceiptDate(transactionDate)}</Text>
                    </View>
                    <Text style={styles.receiptListName}>{accountName}</Text>
                    <Text style={styles.receiptListAccount}>Account #{accountNumber}</Text>
                    <View style={styles.receiptListBottomRow}>
                      <Text style={styles.receiptListAmount}>₹{Number(item.amount ?? item.Amount ?? 0).toFixed(2)}</Text>
                      <Text style={[styles.receiptSyncIcon, uploaded ? styles.receiptSynced : styles.receiptPending]}>{uploaded ? '☁✓' : '☁↑'}</Text>
                    </View>
                    {!!remarks && <Text style={styles.receiptListError}>{remarks}</Text>}
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showPhoneModal} transparent animationType="slide" onRequestClose={() => setShowPhoneModal(false)}>
        <View style={styles.phoneModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPhoneModal(false)} />
          <KeyboardAvoidingView
            style={styles.phoneModalKeyboardArea}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
            pointerEvents="box-none"
          >
          <Pressable
            style={[
              styles.phoneModalCard,
              isPhoneKeyboardVisible && styles.phoneModalCardAboveKeyboard,
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.phoneModalHandle} />
            <Text style={styles.phoneModalTitle}>Add Phone Number</Text>
            <TextInput
              style={styles.phoneModalInput}
              placeholder="Phone Number"
              placeholderTextColor="#777777"
              keyboardType="phone-pad"
              maxLength={10}
              autoCapitalize="none"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              editable={!isUpdatingPhone}
              autoFocus
            />
            <TouchableOpacity style={styles.fetchContactsButton} onPress={handleSelectContact} disabled={isSelectingContact || isUpdatingPhone}>
              {isSelectingContact ? <ActivityIndicator color="#7F7BF4" size="small" /> : <Text style={styles.fetchContactsText}>SELECT FROM CONTACTS</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.phoneModalSave} onPress={handleUpdatePhoneNumber} disabled={isUpdatingPhone}>
              {isUpdatingPhone ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.phoneModalSaveText}>Add Number</Text>}
            </TouchableOpacity>
          </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showPrinterPicker} transparent animationType="slide" onRequestClose={() => setShowPrinterPicker(false)}>
        <View style={[styles.phoneModalRoot, styles.printerModalOverlayCenter]}>
          <View style={styles.printerModalCard}>
            <Text style={styles.phoneModalTitle}>Select Receipt Printer</Text>
            <Text style={styles.printerModalHint}>Choose the connected Bluetooth printer.</Text>
            <FlatList
              data={printerDevices}
              keyExtractor={(item, index) => String(item.address || item.id || index)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.printerDeviceRow} onPress={() => handleSelectPrinter(item.address)}>
                  <Text style={styles.printerDeviceName}>{item.name || 'Bluetooth Printer'}</Text>
                  <Text style={styles.printerDeviceAddress}>{item.address || item.id || ''}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setShowPrinterPicker(false)} style={styles.printerModalCancel}>
              <Text style={styles.phoneModalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
};

const getInitials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A';

const formatDate = (date) => {
  if (!date) return '-';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatReceiptDate = (date) => {
  if (!date) return '-';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const DetailRow = ({ label, value, right = false }) => (
  <View style={[styles.detailCell, right && styles.detailCellRight]}>
    <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
    <Text style={styles.detailLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#C8C6FF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  headerLink: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 42, paddingTop: 16, paddingBottom: 110 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 14, color: '#808080', textAlign: 'center', marginBottom: 4 },

  summaryTotalLabel: { fontSize: 12, color: '#808080', marginTop: 6 },
  summaryTotalAmount: { fontSize: 20, fontWeight: '700', color: '#000000' },

  accountSubText: { fontSize: 12, color: '#808080', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#EEEEEE', marginVertical: 10 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },

  amountLabel: { fontSize: 14, color: '#000000', marginBottom: 6 },

  amountInputError: { borderColor: '#FF0000' },

  primaryButtonSmall: {
    backgroundColor: '#7F7BF4',
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },

  outlineButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#7F7BF4',
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  outlineButtonText: { color: '#7F7BF4', fontSize: 16, fontWeight: '600' },

  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginBottom: 10,
  },
  receiptCheckmark: {
    fontSize: 40,
    color: '#006400',
    marginBottom: 8,
  },
  receiptButtonsRow: { flexDirection: 'row', gap: 10 },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  navButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  navButtonDisabled: { opacity: 0.3 },
  navButtonText: { color: '#7F7BF4', fontSize: 14, fontWeight: '600' },
  navPosition: { fontSize: 13, color: '#808080' },

  modalContainer: { flex: 1, backgroundColor: '#F8FAFC', marginTop: 220, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  modalTitle: { color: '#17324D', fontSize: 20, fontWeight: '700' },
  modalSubtitle: { color: '#657789', fontSize: 13, marginTop: 5 },
  closeButtonTouchTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeButton: { color: '#17324D', fontSize: 18, fontWeight: '500', lineHeight: 22 },
  searchInput: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D3DEE7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#17324D',
    backgroundColor: '#F8FAFC',
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 8 },
  filterButton: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#B9CBD8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 10,
  },
  filterButtonActive: { backgroundColor: '#2874B2', borderColor: '#2874B2' },
  filterButtonText: { color: '#2874B2', fontSize: 13, fontWeight: '700' },
  filterButtonTextActive: { color: '#FFFFFF' },
  modalList: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  accountListItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 9,
    elevation: 2,
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  accountListName: { fontSize: 15, color: '#17324D', fontWeight: '700' },
  accountListSub: { fontSize: 12, color: '#657789', marginTop: 5 },

  // Reference collection-screen layout
  container: { flex: 1 },
  keyboardArea: { flex: 1 },
  screenContent: { flex: 1 },
  screenContentContainer: { paddingTop: 10, paddingBottom: 24 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 4, shadowColor: '#163B57', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 5, marginBottom: 14 },
  summaryTitle: { fontSize: 18, fontWeight: '700', color: '#fff', backgroundColor: '#2874B2', width: '100%', textAlign: 'center', paddingVertical: 10, borderRadius: 10 },
  summaryCountsRow: { flexDirection: 'row', marginTop: 10, width: '100%' },
  summaryBox: { alignItems: 'center', borderWidth: 1, borderColor: '#B9CBD8', borderRadius: 10, flex: 1, marginHorizontal: 6, paddingVertical: 8 },
  summaryCountItem: { alignItems: 'center', borderWidth: 1, borderColor: '#B9CBD8', borderRadius: 10, flex: 1, marginHorizontal: 6, paddingVertical: 8 },
  summaryBoxActive: { backgroundColor: '#EAF2F7', borderColor: '#2874B2' },
  summaryCountValue: { fontSize: 20, fontWeight: '700', color: '#111' },
  summaryCountLabel: { fontSize: 13, color: '#657789', marginTop: 4 },
  actionPills: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', columnGap: 6, marginHorizontal: 12, marginBottom: 18 },
  dashboardFooterButton: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#8783F5', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 10, elevation: 2, shadowColor: '#39356B', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  dashboardFooterButtonCompact: { paddingHorizontal: 18 },
  dashboardFooterIcon: { color: '#7F7BF4', fontSize: 30, lineHeight: 30, marginRight: 11 },
  dashboardFooterText: { color: '#7F7BF4', fontSize: 19, letterSpacing: 1.4, fontWeight: '700' },
  positionPill: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#8783F5', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 9, elevation: 2, shadowColor: '#39356B', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  positionPillCompact: { paddingHorizontal: 18 },
  uploadIcon: { color: '#7F7BF4', fontSize: 33, lineHeight: 34, marginRight: 12 },
  positionPillText: { color: '#7F7BF4', fontSize: 19, letterSpacing: 1.4, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D5E2EB',
    elevation: 7,
    shadowColor: '#163B57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
  },
  printerModalOverlayCenter: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  accountHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 0, backgroundColor: '#2874B2', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  accountTitleBlock: { flex: 1 },
  accountName: { fontSize: 16, fontWeight: '800', color: '#17324D', textTransform: 'uppercase', marginBottom: 7 },
  phoneLink: { fontSize: 14, color: '#2874B2', fontWeight: '600' },
  locationButton: { width: 50, height: 50, marginLeft: 7, borderRadius: 25, backgroundColor: '#FFF3F0', alignItems: 'center', justifyContent: 'center' },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    paddingTop: 14,
  },
  detailCell: { width: '50%', minHeight: 58, paddingRight: 12, paddingBottom: 14, alignItems: 'flex-start' },
  detailCellRight: { paddingLeft: 14, paddingRight: 0, borderLeftWidth: 1, borderLeftColor: '#E3ECF2' },
  schemeCell: { width: '100%', paddingTop: 2, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E3ECF2' },
  detailValue: { width: '100%', fontSize: 15, fontWeight: '800', color: '#17324D', marginBottom: 5, textAlign: 'left' },
  detailLabel: { width: '100%', fontSize: 12, color: '#718395', textAlign: 'left' },
  collectionSection: { paddingTop: 18 },
  amountControlRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  amountAdjustButton: { width: 56, height: 64, backgroundColor: '#2874B2', alignItems: 'center', justifyContent: 'center' },
  amountAdjustText: { color: '#fff', fontSize: 28, fontWeight: '600' },
  amountField: { flex: 1, height: 64, borderWidth: 1.5, borderColor: '#B9CBD8', borderRadius: 10, marginHorizontal: 6, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#F8FAFC' },
  amountFieldHighlighted: { borderColor: '#2874B2', backgroundColor: '#FFFFFF' },
  amountFloatingLabel: { position: 'absolute', top: -9, left: 14, paddingHorizontal: 6, backgroundColor: '#fff', color: '#2874B2', fontWeight: '700', fontSize: 13 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontSize: 21, color: '#9AAAB7', fontWeight: '700', marginRight: 6 },
  currencyPrefixHighlighted: { color: '#2874B2' },
  amountInput: { flex: 1, fontSize: 20, color: '#17324D', padding: 0, paddingRight: 30 },
  amountErrorIcon: { position: 'absolute', right: 18, top: 24, width: 28, height: 28, borderRadius: 14, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#B00020', color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  errorText: { color: '#B00020', fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  primaryButton: { backgroundColor: '#2874B2', borderRadius: 10, minHeight: 52, paddingVertical: 14, alignItems: 'center', marginTop: 18, elevation: 2 },
  primaryButtonText: { color: '#fff', fontSize: 20, letterSpacing: 1.4, fontWeight: '700' },
  receiptSection: { paddingTop: 18 },
  successText: { color: '#08791B', fontSize: 20, fontWeight: '800', marginBottom: 9 },
  receiptNumber: { fontSize: 17, fontWeight: '600', color: '#808080', marginBottom: 15 },
  receiptAction: { height: 86, borderWidth: 2, borderColor: '#8A86F6', borderRadius: 23, flexDirection: 'row', overflow: 'hidden' },
  printAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 25 },
  printActionText: { color: '#7F7BF4', fontSize: 22, fontWeight: '700' },
  whatsappAction: { width: 76, alignItems: 'center', justifyContent: 'center' },
  referenceBottomNav: { marginHorizontal: 28, marginTop: 10, borderTopWidth: 2, borderTopColor: '#918EF3', backgroundColor: 'transparent', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 7, paddingBottom: 10 },
  referenceNavItem: { alignItems: 'center', minWidth: 80 },
  referenceNavIcon: { color: '#111', fontSize: 30, fontWeight: '700', lineHeight: 32 },
  referenceNavLabel: { color: '#17324D', fontSize: 13, fontWeight: '700' },
  phoneModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  phoneModalKeyboardArea: { position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  phoneModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, maxHeight: '90%' },
  phoneModalCardAboveKeyboard: { marginBottom: 28 },
  phoneModalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#D4D4D4', marginBottom: 18 },
  phoneModalTitle: { color: '#17324D', fontSize: 21, fontWeight: '700', textAlign: 'center', marginBottom: 18 },
  phoneModalInput: { borderWidth: 1.5, borderColor: '#C8D4DE', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: '#17324D', backgroundColor: '#F8FAFC' },
  fetchContactsButton: { alignItems: 'center', paddingVertical: 16 },
  fetchContactsText: { color: '#7F7BF4', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  phoneModalCancelButton: { alignItems: 'center', paddingTop: 16 },
  phoneModalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 18, gap: 18 },
  phoneModalCancel: { color: '#7F7BF4', fontSize: 16, fontWeight: '700' },
  phoneModalSave: { backgroundColor: '#7F7BF4', borderRadius: 18, minWidth: 82, paddingVertical: 10, alignItems: 'center' },
  phoneModalSaveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  printerModalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, maxHeight: '65%' },
  printerModalHint: { color: '#777777', fontSize: 14, marginBottom: 12 },
  printerDeviceRow: { borderWidth: 1, borderColor: '#E0DFFF', borderRadius: 10, padding: 14, marginBottom: 10 },
  printerDeviceName: { color: '#111111', fontSize: 16, fontWeight: '700' },
  printerDeviceAddress: { color: '#777777', fontSize: 13, marginTop: 4 },
  printerModalCancel: { alignSelf: 'flex-end', paddingTop: 8 },
  receiptsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  receiptsSheet: { maxHeight: '72%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 20, paddingHorizontal: 20 },
  receiptsSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  receiptsSheetTitle: { color: '#111111', fontSize: 22, fontWeight: '800' },
  receiptsCloseButton: { width: 35, height: 35, borderRadius: 18, borderWidth: 3, borderColor: '#111111', alignItems: 'center', justifyContent: 'center' },
  receiptsClose: { color: '#111111', fontSize: 21, fontWeight: '800', lineHeight: 24 },
  receiptsList: { paddingBottom: 26 },
  receiptListCard: { backgroundColor: '#FFFFFF', borderRadius: 9, padding: 12, marginVertical: 8, elevation: 4, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4 },
  receiptListTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  receiptListMeta: { flex: 1, color: '#828282', fontSize: 14 },
  receiptListName: { color: '#111111', fontSize: 18, fontWeight: '800', marginTop: 16 },
  receiptListAccount: { color: '#828282', fontSize: 15, marginTop: 10 },
  receiptListBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  receiptListAmount: { color: '#7F7BF4', fontSize: 18, fontWeight: '800' },
  receiptSyncIcon: { fontSize: 26, fontWeight: '700' },
  receiptSynced: { color: '#08791B' },
  receiptPending: { color: '#F58A07' },
  receiptListError: { color: '#D84343', fontSize: 12, marginTop: 6 },
});

export default CollectionScreen;