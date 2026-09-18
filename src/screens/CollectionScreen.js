import PygmaLoader from '../components/PygmaLoader';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Modal,
  FlatList,
  ScrollView,
  useWindowDimensions,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
  Pressable,
  TouchableWithoutFeedback,
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
import ErrorDialog from '../components/ErrorDialog';
import { getPrimaryColor, DEFAULT_PRIMARY_COLOR, UI_COLORS, UI_FONT } from '../utils/theme';

const collectionIconPaths = {
  dashboard: 'M520 360V120h320v240H520ZM120 520V120h320v400H120ZM520 840V440h320v400H520ZM120 840V600h320v240H120ZM200 440h160V200H200v240ZM600 760h160V520H600v240ZM600 280h160v-80H600v80ZM200 760h160v-80H200v80Z',
  upload: 'M440 640V314L336 418l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240 800q-33 0-56.5-23.5T160 720V600h80v120h480V600h80v120q0 33-23.5 56.5T720 800H240Z',
  cloudPending: 'M260 800q-91 0-155.5-63T40 583q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760 440q69 8 114.5 59.5T920 620q0 75-52.5 127.5T740 800H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480 240q-83 0-141.5 58.5T280 440h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-80q17 0 28.5-11.5T520 600q0-17-11.5-28.5T480 560q-17 0-28.5 11.5T440 600q0 17 11.5 28.5T480 640Zm-40-140h80V320h-80v180Z',
  cloudSuccess: 'M414 680 640 454l-58-58-169 169-84-84-57 57 142 142ZM260 800q-91 0-155.5-63T40 583q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760 440q69 8 114.5 59.5T920 620q0 75-52.5 127.5T740 800H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480 240q-83 0-141.5 58.5T280 440h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Z',
  close: 'M336 680 480 536 624 680l56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56Zm144 200q-83 0-156-31.5T197 763Q143 709 111.5 636T80 480q0-83 31.5-156T197 197q54-54 127-85.5T480 80q83 0 156 31.5T763 197q54 54 85.5 127T880 480q0 83-31.5 156T763 763q-54 54-127 85.5T480 880Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z',
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

const PhoneIcon = ({ size = 14, color = '#808080' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
    <Path
      fill={color}
      d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99Z"
    />
  </Svg>
);

const CollectionScreen = ({ navigation, route }) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = screenWidth < 390;
  const contentPadding = screenWidth >= 500 ? 32 : 16;
  const [accounts, setAccounts] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [user, setUser] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const screenScrollRef = useRef(null);
  const isContactPickerOpenRef = useRef(false);
  const [amountError, setAmountError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [isCollectingAgain, setIsCollectingAgain] = useState(false);
  const [showAccountList, setShowAccountList] = useState(false);
  const [filterMode, setFilterMode] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const [summary, setSummary] = useState({ totalAmount: 0, uploaded: 0, pending: 0 });
  const [syncProgress, setSyncProgress] = useState({ uploaded: 0, total: 0, pending: 0 });
  const [validation, setValidation] = useState(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [openWhatsAppAfterPhoneUpdate, setOpenWhatsAppAfterPhoneUpdate] = useState(false);
  const [isSelectingContact, setIsSelectingContact] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const [receiptTransactions, setReceiptTransactions] = useState([]);
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [printerDevices, setPrinterDevices] = useState([]);
  const [isSearchingPrinters, setIsSearchingPrinters] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [showCollectConfirm, setShowCollectConfirm] = useState(false);

  useEffect(() => {
    loadAccounts();
    const unsubscribeConnectivity = ConnectivityService.subscribe(async () => {
      await refreshSyncProgress();
      setReceiptTransactions(await DatabaseService.getTransactions());
    });
    const unsubscribeFocus = navigation.addListener('focus', async () => {
      await refreshSyncProgress();
      setReceiptTransactions(await DatabaseService.getTransactions());
    });
    return () => {
      unsubscribeConnectivity();
      unsubscribeFocus();
    };
  }, [navigation]);

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
    } finally {
      setIsLoadingAccounts(false);
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

  // Android classifies an account by receipt/collection count, not by the
  // collected amount. A valid receipt can therefore never disappear merely
  // because its amount field is absent from an older local row.
  const isAccountCollected = (account) =>
    Number(account?.collectionCount ?? account?.CollectionCount) > 0;

  const visibleAccounts = accounts.filter((account) => {
    const collected = isAccountCollected(account);
    if (accountFilter === 'collected') return collected;
    if (accountFilter === 'pending') return !collected;
    return true;
  });
  const currentAccount = visibleAccounts[currentIndex] || null;
  // A collected account can be reopened from the list later. Keep its last
  // receipt visible so the user can print it or start another collection.
  const displayedReceiptNumber = isCollectingAgain ? '' : (receiptNumber || currentAccount?.lastReceipt || '');
  const collectedAccountCount = accounts.filter(isAccountCollected).length;
  const primaryColor = getPrimaryColor(user);
  const maxReceiptsPerAccount = Number(
    validation?.MaxReceiptsCount ?? validation?.maxReceiptsCount
  );
  const currentAccountReceiptCount = Number(
    currentAccount?.collectionCount ?? currentAccount?.CollectionCount
  ) || 0;
  const isReceiptLimitReached = Number.isFinite(maxReceiptsPerAccount)
    && maxReceiptsPerAccount > 0
    && currentAccountReceiptCount >= maxReceiptsPerAccount;
  const receiptLimitMessage = isReceiptLimitReached
    ? `This account reached the maximum (${maxReceiptsPerAccount} per account) allowed receipts`
    : '';

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
    if (isReceiptLimitReached) {
      setAmount('');
      setAmountError(receiptLimitMessage);
      return;
    }
    const defaultAmount = getAccountDefaultAmount(currentAccount);
    const defaultValue = Number(defaultAmount);
    const remainingAmount = getRemainingAllowedAmount();
    setAmount(defaultAmount);
    if (remainingAmount !== null && Number.isFinite(defaultValue) && defaultValue > remainingAmount) {
      setAmountError(`You can collect upto ₹${remainingAmount.toFixed(2)}`);
    } else {
      setAmountError('');
    }
  }, [currentAccount?.AccountId, receiptNumber, validation, accounts, isReceiptLimitReached, receiptLimitMessage]);

  const closeAccountList = () => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setShowAccountList(false);
  };

  const openAccountList = (mode) => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery('');
    setFilterMode(mode);
    setShowAccountList(true);
  };

  const selectAccountFilter = (nextFilter) => {
    const matchingAccounts = accounts.filter((account) => {
      if (nextFilter === 'collected') return isAccountCollected(account);
      if (nextFilter === 'pending') return !isAccountCollected(account);
      return true;
    });

    // Legacy CollectionFragment shows "No accounts found" and leaves the
    // currently displayed account untouched when a category is empty.
    if (!matchingAccounts.length) {
      closeAccountList();
      setErrorMessage('No accounts found');
      setShowError(true);
      return;
    }

    setAccountFilter(nextFilter);
    openAccountList(nextFilter === 'pending' ? 'uncollected' : nextFilter);
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

    if (isReceiptLimitReached) {
      setAmountError(receiptLimitMessage);
      return false;
    }
    return true;
  };

  const handleAmountChange = (value) => {
    if (isReceiptLimitReached) return;
    setAmount(value);
    validateAmount(value);
  };

  const amountStep = Math.max(Number(currentAccount?.AgreedAmount) || 100, 0.01);
  const adjustAmount = (direction) => {
    if (isReceiptLimitReached) {
      setAmountError(receiptLimitMessage);
      return;
    }
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
      setErrorMessage('No account selected');
      setShowError(true);
      return;
    }
    if (isReceiptLimitReached) {
      setAmountError(receiptLimitMessage);
      return;
    }
    if (!validateAmount(amount)) return;
    if (!canCollect(parseFloat(amount))) return;

    setIsLoading(true);
    try {
      let location = null;
      try {
        const hasLocationPermission = await LocationService.requestLocationPermission();
        // A receipt should not leave the button blocked while the phone waits
        // a long time for a fresh GPS fix. Prefer a recent device location and
        // cap this optional lookup; the existing zero-coordinate fallback is
        // retained when location services are unavailable.
        if (hasLocationPermission) {
          location = await LocationService.getCurrentLocation({
            timeout: 5000,
            maximumAge: 60000,
          });
        }
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
      setIsCollectingAgain(false);
      setAccounts((current) => current.map((account) =>
        account.AccountId === currentAccount.AccountId
          ? { ...account, collectionCount: (Number(account.collectionCount) || 0) + 1, lastCollectedAmt: (Number(account.lastCollectedAmt) || 0) + collectedAmount, lastReceipt: receiptNum }
          : account
      ));
      setSummary((s) => ({
        ...s,
        totalAmount: s.totalAmount + collectedAmount,
        pending: s.pending + 1,
      }));
      setAmount('');

      // The transaction and its retry queue entry are safely stored above, so
      // show the receipt immediately. Uploading is best-effort background work
      // and must not keep the Collect button spinning on a slow connection.
      setIsLoading(false);
      ApiService.syncOfflineQueue()
        .then(async () => {
          await refreshSyncProgress();
          const transactions = await DatabaseService.getTransactions();
          const pending = transactions.filter((transaction) =>
            Number(transaction.syncStatus ?? transaction.SyncStatus) === 0
          ).length;
          setSummary((current) => ({
            ...current,
            uploaded: Math.max(transactions.length - pending, 0),
            pending,
          }));
        })
        .catch((error) => {
          console.log('Background collection sync failed:', error.message || error);
        });
    } catch (error) {
      setErrorMessage(error.message || 'Collection failed');
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const requestCollect = () => {
    const requestedAmount = Number.parseFloat(amount) || 0;
    if (!validateAmount(amount) || !canCollect(requestedAmount)) return;
    setShowCollectConfirm(true);
  };

  const handleCollectAgain = () => {
    setIsCollectingAgain(true);
    setReceiptNumber('');
    setAmount(getAccountDefaultAmount(currentAccount));
    setAmountError('');
  };

  const handleViewReceipts = async () => {
    const transactions = await DatabaseService.getTransactions();
    if (!transactions.length) {
      setErrorMessage('No Transactions found');
      setShowError(true);
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
      const selectedNumber = Platform.OS === 'ios'
        ? await NativeModules.PygmaContactPicker.selectPhone()
        : await NativeModules.PygmaContactPicker.selectPhone();
      if (!selectedNumber) return;

      const number = String(selectedNumber)
        .replace(/\D/g, '')
        .slice(-10);
      if (number.length !== 10) {
        throw new Error('This contact does not have a valid 10 digit mobile number.');
      }
      setPhoneNumber(number);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load contacts.');
      setShowError(true);
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
        throw new Error('Bluetooth access is required to find the receipt printer. Allow it in Settings and try again.');
      }
      const bluetoothEnabled = await BluetoothService.requestBluetoothEnabled();
      if (!bluetoothEnabled) {
        throw new Error('Turn on Bluetooth in Settings, then try printing again.');
      }
      const result = await ReceiptService.printReceipt(await getReceiptPayload());
      if (result.needsPrinterSelection) {
        setPrinterDevices(result.devices);
        setShowPrinterPicker(true);
        setIsSearchingPrinters(false);
      }
    } catch (error) {
      console.warn('[Printer] Print failed:', error.message || String(error));
      setErrorMessage(error.message || 'Unable to print the receipt.');
      setShowError(true);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSelectPrinter = async (printerAddress) => {
    setShowPrinterPicker(false);
    setIsSearchingPrinters(false);
    setIsPrinting(true);
    try {
      await ReceiptService.printWithSelectedPrinter(printerAddress, await getReceiptPayload());
    } catch (error) {
      console.warn('[Printer] Print failed:', error.message || String(error));
      setErrorMessage(error.message || 'Unable to print the receipt.');
      setShowError(true);
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
        setErrorMessage(message || 'WhatsApp is not installed or could not be opened on this device.');
        setShowError(true);
      }
    }
  };

  const handleUpdatePhoneNumber = async () => {
    const number = phoneNumber.trim();
    if (!/^\d{10}$/.test(number)) {
      setPhoneError('Enter a valid 10 digit mobile number.');
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
      setErrorMessage(error.message || 'Unable to update phone number');
      setShowError(true);
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
          setErrorMessage('Allow location access to open your current location.');
        setShowError(true);
          return;
        }
        const currentLocation = await LocationService.getCurrentLocation();
        destinationLatitude = Number(currentLocation.latitude);
        destinationLongitude = Number(currentLocation.longitude);
        if (!Number.isFinite(destinationLatitude) || !Number.isFinite(destinationLongitude)) {
          throw new Error('Invalid current location');
        }
      } catch (error) {
        setErrorMessage('Unable to fetch your current location. Please check location services and try again.');
        setShowError(true);
        return;
      }
    }
    try {
      if (Platform.OS === 'android' && NativeModules.PygmaMapChooser) {
        await NativeModules.PygmaMapChooser.open(destinationLatitude, destinationLongitude);
        return;
      }
      await Linking.openURL(`https://maps.apple.com/?ll=${destinationLatitude},${destinationLongitude}&q=Current%20Location`);
    } catch (error) {
      try {
        await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${destinationLatitude},${destinationLongitude}`);
      } catch (fallbackError) {
        setErrorMessage('Unable to open directions on this device.');
        setShowError(true);
      }
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsCollectingAgain(false);
      setReceiptNumber('');
      setAmount('');
      setAmountError('');
    }
  };

  const goToNext = () => {
    if (currentIndex < visibleAccounts.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsCollectingAgain(false);
      setReceiptNumber('');
      setAmount('');
      setAmountError('');
    }
  };

  const openAccountSearch = () => {
    openAccountList('all');
  };

  const handleSelectFromList = (index) => {
    const visibleIndex = visibleAccounts.findIndex((account) => account.AccountId === accounts[index]?.AccountId);
    if (filterMode === 'all') {
      setAccountFilter('all');
      setCurrentIndex(index);
    } else {
      setCurrentIndex(visibleIndex >= 0 ? visibleIndex : 0);
    }
    closeAccountList();
    setIsCollectingAgain(false);
    setReceiptNumber('');
    setAmount('');
    setAmountError('');
  };

  const filteredAccounts = accounts
    .map((a, idx) => ({ ...a, _idx: idx }))
    .filter((a) => {
      if (filterMode === 'uncollected' && isAccountCollected(a)) return false;
      if (filterMode === 'collected' && !isAccountCollected(a)) return false;
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
      <Text style={styles.accountListSub}>A/c Number:{item.AccountNumber}</Text>
      <Text style={styles.accountListSub}>Contact:{item.MobileNumber}</Text>
    </TouchableOpacity>
  );

  if (isLoadingAccounts) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={UI_COLORS.surface} />
        <PygmaLoader fullScreen />
      </>
    );
  }

  if (!currentAccount) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={primaryColor} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')}>
            <Text style={styles.headerLink}>Dashboard</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{accounts.length ? `No ${accountFilter} accounts.` : 'No accounts downloaded yet.'}</Text>
          <Text style={styles.emptyText}>{accounts.length ? 'Choose another status above.' : 'Go to Dashboard and tap Download.'}</Text>
        </View>
        <TouchableOpacity style={[styles.dashboardFooterButton, { borderColor: primaryColor }]} onPress={() => navigation.navigate('Dashboard')}>
          <CollectionIcon name="dashboard" size={26} color={primaryColor} style={styles.dashboardFooterIcon} />
          <Text style={[styles.dashboardFooterText, { color: primaryColor }]}>Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <LinearGradient
        colors={[primaryColor, '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.45, 1]}
        style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 10) }]}
      >
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          <Text style={[styles.summaryTitle, { backgroundColor: primaryColor }]}>{user?.BankName || user?.BankShortName || 'Society'}</Text>
          <View style={styles.summaryCountsRow}>
            <TouchableOpacity style={[styles.summaryBox, { borderColor: primaryColor }, accountFilter === 'all' && styles.summaryBoxActive]} onPress={() => selectAccountFilter('all')}>
              <Text style={styles.summaryCountValue}>{accounts.length}</Text>
              <Text style={styles.summaryCountLabel}>Total</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.summaryCountItem, { borderColor: primaryColor }, accountFilter === 'collected' && styles.summaryBoxActive]} onPress={() => selectAccountFilter('collected')}>
              <Text style={styles.summaryCountValue}>{collectedAccountCount}</Text>
              <Text style={styles.summaryCountLabel}>Collected</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.summaryCountItem, { borderColor: primaryColor }, accountFilter === 'pending' && styles.summaryBoxActive]} onPress={() => selectAccountFilter('pending')}>
              <Text style={styles.summaryCountValue}>
                {Math.max(accounts.length - collectedAccountCount, 0)}
              </Text>
              <Text style={styles.summaryCountLabel}>Pending</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.actionPills, syncProgress.total === 0 && styles.actionPillsCentered]}>
          <TouchableOpacity style={[styles.dashboardFooterButton, { borderColor: primaryColor }, isCompact && styles.dashboardFooterButtonCompact]} onPress={() => navigation.navigate('Dashboard')}>
            <CollectionIcon name="dashboard" size={24} color={primaryColor} style={styles.dashboardFooterIcon} />
            <Text style={[styles.dashboardFooterText, { color: primaryColor }]}>Dashboard</Text>
          </TouchableOpacity>
          {syncProgress.total > 0 && <TouchableOpacity
            style={[styles.positionPill, { borderColor: primaryColor }, isCompact && styles.positionPillCompact]}
            onPress={handleViewReceipts}
            disabled={isLoading}
            accessibilityLabel="View receipts and sync pending collections"
          >
            <CollectionIcon name="upload" size={24} color={primaryColor} style={styles.syncUploadIcon} />
            <Text style={[styles.positionPillText, { color: primaryColor }]}>{syncProgress.uploaded}/{syncProgress.total}</Text>
          </TouchableOpacity>}
        </View>

        {/* Account details and collection action */}
        <View style={styles.card}>
          <View style={styles.accountHeader}>
            <View style={[styles.avatar, { backgroundColor: primaryColor }]}><Text style={styles.avatarText}>{getInitials(currentAccount.AccountName)}</Text></View>
            <View style={styles.accountTitleBlock}>
              <Text style={styles.accountName}>{currentAccount.AccountName}</Text>
              <TouchableOpacity onPress={openPhoneEditor} disabled={isLoading}>
                {currentAccount.MobileNumber ? (
                  <View style={styles.phoneRow}>
                    <PhoneIcon />
                    <Text style={styles.phoneLink}>{currentAccount.MobileNumber}</Text>
                  </View>
                ) : (
                  <Text style={[styles.phoneLink, { color: primaryColor }]}>Add Phone Number</Text>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handlePrint} disabled={isPrinting} accessibilityLabel="Print account receipt">
              <PrintIcon size={35} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.locationButton} onPress={handleOpenDirections} accessibilityLabel="Open account location in maps">
              <CollectionIcon name="location" size={35} color="#E66754" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsGrid}>
            <DetailRow label="Account Number" value={currentAccount.AccountNumber || '-'} />
            <DetailRow right label="Balance" value={`₹${Number(currentAccount.BalanceAmount || 0).toFixed(2)}`} />
            {String(currentAccount.LeanAccountNumber ?? currentAccount.leanAccountNumber ?? '').trim() ? (
              <>
                <DetailRow label="Lean Account Number" value={String(currentAccount.LeanAccountNumber ?? currentAccount.leanAccountNumber).trim()} />
                <DetailRow right label="Lean Amount" value={`₹${Number(currentAccount.LeanAmount ?? currentAccount.leanAmount ?? 0).toFixed(2)}`} />
              </>
            ) : null}
            <DetailRow label="Opening Date" value={formatDate(currentAccount.OpeningDate)} />
            <DetailRow right label="Last Collection Date" value={formatDate(currentAccount.LastTranDate)} />
            <View style={styles.schemeCell}>
              <Text style={styles.detailValue}>{`${currentAccount.SchemeCode ?? currentAccount.schemeCode ? `(${currentAccount.SchemeCode ?? currentAccount.schemeCode}) ` : ''}${currentAccount.SchemeName ?? currentAccount.schemeName ?? '-'}`}</Text>
              <Text style={styles.detailLabel}>Scheme</Text>
            </View>
          </View>

          {displayedReceiptNumber ? (
            <View style={styles.receiptSection}>
              <Text style={styles.successText}>✿ ₹{Number(currentAccount.lastCollectedAmt || amount || 0).toFixed(2)} is collected</Text>
              <Text style={styles.receiptNumber}>Receipt #{displayedReceiptNumber}</Text>
              <View style={[styles.receiptAction, { borderColor: primaryColor }]}>
                <TouchableOpacity style={styles.printAction} onPress={handlePrint} disabled={isPrinting}>
                  <Text style={[styles.printActionText, { color: primaryColor }]}>Print</Text>
                  <PrintIcon size={40} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.whatsappAction} onPress={() => handleWhatsAppReceipt()} accessibilityLabel="Send receipt by WhatsApp">
                  <WhatsAppIcon size={40} />
                </TouchableOpacity>
              </View>
              {!isReceiptLimitReached && (
                <TouchableOpacity
                  style={[styles.collectAgainButton, { backgroundColor: primaryColor }]}
                  onPress={handleCollectAgain}
                  disabled={isLoading}
                  accessibilityLabel="Collect again for this account"
                >
                  <Text style={styles.primaryButtonText}>Collect Again</Text>
                </TouchableOpacity>
              )}
              {isReceiptLimitReached && <Text style={styles.errorText}>{receiptLimitMessage}</Text>}
            </View>
          ) : (
            <View style={styles.collectionSection}>
              <View style={styles.amountControlRow}>
                <TouchableOpacity
                  style={[styles.amountAdjustButton, { backgroundColor: primaryColor }, isReceiptLimitReached && styles.buttonDisabled]}
                  onPress={() => adjustAmount(-1)}
                  disabled={isLoading || isReceiptLimitReached}
                  accessibilityLabel="Decrease amount"
                >
                  <Text style={styles.amountAdjustText}>−</Text>
                </TouchableOpacity>
                <View style={[styles.amountField, (amountFocused || amount) && { borderColor: primaryColor, backgroundColor: '#FFFFFF' }, amountError && styles.amountInputError, isReceiptLimitReached && styles.amountFieldDisabled]}>
                  <Text style={[styles.amountFloatingLabel, { color: amountError ? UI_COLORS.error : primaryColor }]}>Amount</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={[styles.currencyPrefix, (amountFocused || amount) && { color: primaryColor }]}>₹</Text>
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
                      onBlur={() => {
                        setAmountFocused(false);
                        validateAmount(amount);
                      }}
                      editable={!isLoading && !isReceiptLimitReached}
                    />
                  </View>
                  {!!amountError && <Text style={styles.amountErrorIcon}>!</Text>}
                </View>
                <TouchableOpacity
                  style={[styles.amountAdjustButton, { backgroundColor: primaryColor }, isReceiptLimitReached && styles.buttonDisabled]}
                  onPress={() => adjustAmount(1)}
                  disabled={isLoading || isReceiptLimitReached}
                  accessibilityLabel="Increase amount"
                >
                  <Text style={styles.amountAdjustText}>+</Text>
                </TouchableOpacity>
              </View>
              {!!amountError && <Text style={styles.errorText}>{amountError}</Text>}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: primaryColor }, (!amount || !!amountError || isReceiptLimitReached) && styles.buttonDisabled]}
                onPress={requestCollect}
                disabled={isLoading || isReceiptLimitReached || !amount || !!amountError}
              >
                {isLoading ? <PygmaLoader size="small" /> : <Text style={styles.primaryButtonText}>Collect</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.referenceBottomNav, { borderTopColor: primaryColor }]}>
        <TouchableOpacity onPress={goToPrevious} disabled={currentIndex === 0} style={styles.referenceNavItem}>
          <CollectionIcon name="previous" size={31} color="#111111" style={[styles.referenceNavIcon, currentIndex === 0 && styles.navButtonDisabled]} />
          <Text style={styles.referenceNavLabel}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openAccountSearch} style={styles.referenceNavItem}>
          <CollectionIcon name="search" size={31} color="#111111" style={styles.referenceNavIcon} />
          <Text style={styles.referenceNavLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNext} disabled={currentIndex >= visibleAccounts.length - 1} style={styles.referenceNavItem}>
          <CollectionIcon name="next" size={31} color="#111111" style={[styles.referenceNavIcon, currentIndex >= visibleAccounts.length - 1 && styles.navButtonDisabled]} />
          <Text style={styles.referenceNavLabel}>Next</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showCollectConfirm} transparent animationType="fade" onRequestClose={() => setShowCollectConfirm(false)}>
        <View style={styles.collectConfirmOverlay}>
          <View style={styles.collectConfirmCard}>
            <View style={styles.collectConfirmBrand}>
              <Image source={require('../assets/images/logo.png')} style={styles.collectConfirmLogo} />
              <Text style={[styles.collectConfirmBrandName, { color: primaryColor }]}>Pygma</Text>
            </View>
            <Text style={styles.collectConfirmText}>Account Name: {currentAccount?.AccountName || '-'}</Text>
            <Text style={styles.collectConfirmText}>A/c Number: {currentAccount?.AccountNumber || '-'}</Text>
            <Text style={styles.collectConfirmAmount}>Amount: ₹{(Number.parseFloat(amount) || 0).toFixed(2)}</Text>
            <View style={styles.collectConfirmActions}>
              <TouchableOpacity style={[styles.collectConfirmNo, { borderColor: primaryColor }]} onPress={() => setShowCollectConfirm(false)}>
                <Text style={[styles.collectConfirmNoText, { color: primaryColor }]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.collectConfirmYes, { backgroundColor: primaryColor }]}
                onPress={() => { setShowCollectConfirm(false); handleCollect(); }}
              >
                <Text style={styles.collectConfirmYesText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Search shows all accounts; summary categories open a filtered list. */}
      <Modal
        visible={showAccountList}
        animationType="slide"
        transparent
        onRequestClose={closeAccountList}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { marginTop: insets.top, paddingBottom: insets.bottom }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {filterMode === 'uncollected' ? 'Uncollected Accounts' : filterMode === 'collected' ? 'Collected Accounts' : 'All Accounts'}
              </Text>
              <Text style={styles.modalSubtitle}>Select an account to view details</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButtonTouchTarget}
              onPress={closeAccountList}
              accessibilityLabel="Close account list"
            >
              <CollectionIcon name="close" size={26} color={UI_COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchField}>
            <Text
              pointerEvents="none"
              style={[styles.searchLabel, (searchFocused || searchQuery) && styles.searchLabelFloating]}
            >
              Search
            </Text>
            <TextInput
              ref={searchInputRef}
              key={filterMode}
              style={styles.searchInput}
              accessibilityLabel="Search accounts"
              selectionColor={UI_COLORS.search}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          <FlatList
            data={filteredAccounts}
            renderItem={renderAccountListItem}
            keyExtractor={(item) => item.AccountId?.toString()}
            contentContainerStyle={styles.modalList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>No accounts found</Text>}
          />
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen receipts list opened by the upload/receipt pill. */}
      <Modal visible={showReceipts} transparent animationType="slide" onRequestClose={() => setShowReceipts(false)}>
        <View style={[styles.modalContainer, { marginTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={[styles.modalHeader, styles.receiptsHeader]}>
              <Text style={styles.modalTitle}>Receipts</Text>
              <TouchableOpacity style={styles.closeButtonTouchTarget} onPress={() => setShowReceipts(false)} accessibilityLabel="Close receipts">
                <CollectionIcon name="close" size={26} color={UI_COLORS.text} />
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
                      <Text style={styles.receiptListMeta} numberOfLines={1}>Receipt #{receipt}</Text>
                      <Text style={styles.receiptListDate} numberOfLines={1}>{formatReceiptDate(transactionDate)}</Text>
                    </View>
                    <Text style={styles.receiptListName}>{accountName}</Text>
                    <Text style={styles.receiptListAccount}>Account #{accountNumber}</Text>
                    <View style={styles.receiptListBottomRow}>
                      <Text style={[styles.receiptListAmount, { color: primaryColor }]}>{formatReceiptAmount(item.amount ?? item.Amount)}</Text>
                      <CollectionIcon
                        name={uploaded ? 'cloudSuccess' : 'cloudPending'}
                        size={24}
                        color={uploaded ? '#006400' : '#FF9800'}
                      />
                    </View>
                    {!!remarks && <Text style={styles.receiptListError}>{remarks}</Text>}
                  </View>
                );
              }}
            />
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
            style={styles.phoneModalCard}
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
              onChangeText={(value) => { setPhoneNumber(value); setPhoneError(''); }}
              editable={!isUpdatingPhone}
              autoFocus
            />
            {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
            <TouchableOpacity style={styles.fetchContactsButton} onPress={handleSelectContact} disabled={isSelectingContact || isUpdatingPhone}>
              {isSelectingContact ? <PygmaLoader size="small" /> : <Text style={[styles.fetchContactsText, { color: primaryColor }]}>SELECT FROM CONTACTS</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.phoneModalSave, { backgroundColor: primaryColor }]} onPress={handleUpdatePhoneNumber} disabled={isUpdatingPhone}>
              {isUpdatingPhone ? <PygmaLoader size="small" /> : <Text style={styles.phoneModalSaveText}>Add Number</Text>}
            </TouchableOpacity>
          </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showPrinterPicker} transparent animationType="slide" onRequestClose={() => { setShowPrinterPicker(false); setIsSearchingPrinters(false); }}>
        <View style={styles.printerModalOverlay}>
          <View style={styles.printerModalCard}>
            <View style={styles.printerModalHandle} />
            <View style={styles.printerStatusRow}>
              <Text style={[styles.printerStatusText, { color: primaryColor }]}>
                {isSearchingPrinters ? 'Searching for printers...' : printerDevices.length ? 'Tap to select a device' : 'No printers found'}
              </Text>
              {isSearchingPrinters && <PygmaLoader size="small" />}
            </View>
            {isSearchingPrinters && (
              <View style={styles.printerProgressTrack}>
                <View style={[styles.printerProgressBar, { backgroundColor: primaryColor }]} />
              </View>
            )}
            <FlatList
              data={printerDevices}
              keyExtractor={(item, index) => String(item.address || item.id || index)}
              contentContainerStyle={styles.printerDeviceList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.printerDeviceRow} onPress={() => handleSelectPrinter(item.address || item.id)}>
                  <Text style={styles.printerDeviceName}>{item.name || 'Bluetooth Printer'}</Text>
                  <Text style={styles.printerDeviceAddress}>{item.address || item.id || ''}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => { setShowPrinterPicker(false); setIsSearchingPrinters(false); }} style={styles.printerModalCancel}>
              <Text style={[styles.phoneModalCancel, { color: primaryColor }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ErrorDialog visible={showError} message={errorMessage} primaryColor={primaryColor} onClose={() => setShowError(false)} />
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
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parsed.getMonth()];
  const year = parsed.getFullYear();
  const hours = parsed.getHours();
  const displayHours = String(hours % 12 || 12).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${displayHours}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const formatReceiptAmount = (amount) => Number(amount || 0).toLocaleString('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DetailRow = ({ label, value, right = false }) => (
  <View style={[styles.detailCell, right && styles.detailCellRight]}>
    <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
    <Text style={styles.detailLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI_COLORS.surface },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  headerLink: { color: UI_COLORS.surface, fontSize: UI_FONT.caption, fontWeight: '800' },
  headerTitle: { color: UI_COLORS.surface, fontSize: UI_FONT.body, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 42, paddingTop: 16, paddingBottom: 110 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: UI_FONT.body, color: UI_COLORS.secondaryText, textAlign: 'center', marginBottom: 4 },

  summaryTotalLabel: { fontSize: UI_FONT.caption, color: UI_COLORS.secondaryText, marginTop: 6 },
  summaryTotalAmount: { fontSize: UI_FONT.title, fontWeight: '800', color: UI_COLORS.text },

  accountSubText: { fontSize: UI_FONT.caption, color: UI_COLORS.secondaryText, marginTop: 4 },
  divider: { height: 1, backgroundColor: '#EEEEEE', marginVertical: 10 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },

  amountLabel: { fontSize: UI_FONT.body, color: UI_COLORS.text, marginBottom: 6 },

  amountInputError: { borderColor: '#FF0000' },

  primaryButtonSmall: {
    backgroundColor: DEFAULT_PRIMARY_COLOR,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },

  outlineButton: {
    backgroundColor: UI_COLORS.surface,
    borderColor: DEFAULT_PRIMARY_COLOR,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  outlineButtonText: { color: DEFAULT_PRIMARY_COLOR, fontSize: UI_FONT.action, fontWeight: '800' },

  receiptCard: {
    backgroundColor: UI_COLORS.surface,
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
  navButtonText: { color: DEFAULT_PRIMARY_COLOR, fontSize: UI_FONT.body, fontWeight: '800' },
  navPosition: { fontSize: 13, color: UI_COLORS.secondaryText },

  modalContainer: { flex: 1, backgroundColor: UI_COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: UI_COLORS.surface,
  },
  modalTitle: { color: UI_COLORS.text, fontSize: UI_FONT.body, fontWeight: '800' },
  modalSubtitle: { color: UI_COLORS.secondaryText, fontSize: UI_FONT.body, fontWeight: '800', marginTop: 10 },
  closeButtonTouchTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeButton: { color: UI_COLORS.text, fontSize: UI_FONT.heading, fontWeight: '800', lineHeight: 22 },
  searchField: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 18,
    borderWidth: 2, borderColor: UI_COLORS.search, borderRadius: 8,
    backgroundColor: UI_COLORS.surface,
  },
  searchLabel: {
    position: 'absolute', top: 15, left: 12, zIndex: 1,
    color: UI_COLORS.secondaryText, fontSize: UI_FONT.search, fontWeight: '800',
  },
  searchLabelFloating: {
    top: -10,
    left: 10,
    paddingHorizontal: 4,
    backgroundColor: UI_COLORS.surface,
    color: UI_COLORS.search,
    fontSize: UI_FONT.caption,
  },
  searchInput: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: UI_FONT.search,
    color: UI_COLORS.text,
    backgroundColor: 'transparent',
  },
  modalList: { backgroundColor: UI_COLORS.surface, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  accountListItem: {
    backgroundColor: UI_COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 9,
    elevation: 2,
    shadowColor: UI_COLORS.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  accountListName: { fontSize: UI_FONT.body, color: UI_COLORS.text, fontWeight: '800' },
  accountListSub: { fontSize: UI_FONT.caption, color: UI_COLORS.secondaryText, fontWeight: '800', marginTop: 10 },

  // Reference collection-screen layout
  container: { flex: 1 },
  keyboardArea: { flex: 1 },
  screenContent: { flex: 1 },
  screenContentContainer: { paddingTop: 8, paddingBottom: 16 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 8, padding: 8, elevation: 3, shadowColor: UI_COLORS.text, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4, marginHorizontal: 8, marginBottom: 8 },
  summaryTitle: { fontSize: UI_FONT.action, fontWeight: '800', color: '#fff', backgroundColor: DEFAULT_PRIMARY_COLOR, width: '100%', textAlign: 'center', paddingVertical: 5 },
  summaryCountsRow: { flexDirection: 'row', marginTop: 10, width: '100%' },
  summaryBox: { alignItems: 'center', borderWidth: 1, borderColor: '#B9CBD8', borderRadius: 4, flex: 1, marginHorizontal: 2.5, paddingVertical: 4 },
  summaryCountItem: { alignItems: 'center', borderWidth: 1, borderColor: '#B9CBD8', borderRadius: 4, flex: 1, marginHorizontal: 2.5, paddingVertical: 4 },
  summaryBoxActive: { backgroundColor: UI_COLORS.surface, borderWidth: 2 },
  summaryCountValue: { fontSize: UI_FONT.body, fontWeight: '800', color: UI_COLORS.text },
  summaryCountLabel: { fontSize: UI_FONT.body, color: UI_COLORS.secondaryText, fontWeight: '800', marginTop: 2 },
  actionPills: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', columnGap: 8, marginHorizontal: 10, marginTop: 8, marginBottom: 8 },
  actionPillsCentered: { justifyContent: 'center' },
  dashboardFooterButton: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: DEFAULT_PRIMARY_COLOR, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, elevation: 2, shadowColor: UI_COLORS.text, shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  dashboardFooterButtonCompact: { paddingHorizontal: 12 },
  dashboardFooterIcon: { marginRight: 7 },
  dashboardFooterText: { color: DEFAULT_PRIMARY_COLOR, fontSize: UI_FONT.body, fontWeight: '800' },
  positionPill: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: DEFAULT_PRIMARY_COLOR, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, elevation: 2, shadowColor: UI_COLORS.text, shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  positionPillCompact: { paddingHorizontal: 12 },
  syncUploadIcon: { marginRight: 7 },
  positionPillText: { color: DEFAULT_PRIMARY_COLOR, fontSize: UI_FONT.body, fontWeight: '800' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    margin: 12,
    elevation: 3,
    shadowColor: UI_COLORS.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
  },
  printerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  accountHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 ,marginTop: 6},
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: DEFAULT_PRIMARY_COLOR, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  avatarText: { color: '#fff', fontSize: UI_FONT.body, fontWeight: '800' },
  accountTitleBlock: { flex: 1 },
  accountName: { fontSize: UI_FONT.body, fontWeight: '800', color: UI_COLORS.text, textTransform: 'uppercase', marginBottom: 4 },
  phoneLink: { fontSize: UI_FONT.caption, color: UI_COLORS.secondaryText, fontWeight: '800' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationButton: { width: 35, height: 35, marginLeft: 6, alignItems: 'center', justifyContent: 'center' },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 0,
    paddingTop: 8,
  },
  detailCell: { width: '50%', minHeight: 48, paddingRight: 8, paddingBottom: 8, alignItems: 'flex-start' },
  detailCellRight: { paddingLeft: 8, paddingRight: 0 },
  schemeCell: { width: '100%', paddingTop: 0, paddingBottom: 8 },
  detailValue: { width: '100%', fontSize: UI_FONT.body, fontWeight: '800', color: UI_COLORS.text, marginBottom: 3, textAlign: 'left' },
  detailLabel: { width: '100%', fontSize: UI_FONT.caption, color: UI_COLORS.secondaryText, fontWeight: '800', textAlign: 'left' },
  collectionSection: { paddingTop: 10 },
  amountControlRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  amountAdjustButton: { width: 40, height: 40, backgroundColor: DEFAULT_PRIMARY_COLOR, alignItems: 'center', justifyContent: 'center' },
  amountAdjustText: { color: '#fff', fontSize: UI_FONT.action, fontWeight: '800' },
  amountField: { flex: 1, height: 56, borderWidth: 1.5, borderColor: UI_COLORS.secondaryText, borderRadius: 4, marginHorizontal: 3, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: UI_COLORS.inputBackground },
  amountFieldHighlighted: { borderColor: DEFAULT_PRIMARY_COLOR, backgroundColor: UI_COLORS.inputBackground },
  amountFloatingLabel: { position: 'absolute', top: -8, left: 10, paddingHorizontal: 4, backgroundColor: '#fff', color: DEFAULT_PRIMARY_COLOR, fontWeight: '800', fontSize: UI_FONT.caption },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontSize: UI_FONT.action, color: UI_COLORS.secondaryText, fontWeight: '800', marginRight: 5 },
  currencyPrefixHighlighted: { color: DEFAULT_PRIMARY_COLOR },
  amountInput: { flex: 1, fontSize: UI_FONT.action, color: UI_COLORS.text, padding: 0, paddingRight: 24 },
  amountFieldDisabled: { backgroundColor: '#F2F4F6' },
  amountErrorIcon: { position: 'absolute', right: 12, top: 17, width: 22, height: 22, borderRadius: 11, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: UI_COLORS.error, color: UI_COLORS.surface, fontSize: UI_FONT.body, fontWeight: '800' },
  errorText: { color: UI_COLORS.error, fontSize: UI_FONT.body, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  primaryButton: { backgroundColor: DEFAULT_PRIMARY_COLOR, borderRadius: 15, minHeight: 48, paddingVertical: 12, alignItems: 'center', marginTop: 12, marginBottom: 10, elevation: 2 },
  primaryButtonText: { color: '#fff', fontSize: UI_FONT.action, letterSpacing: 0.8, fontWeight: '800' },
  collectConfirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  collectConfirmCard: { width: '100%', maxWidth: 420, backgroundColor: UI_COLORS.surface, borderRadius: 8, padding: 16, paddingBottom: 18, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
  collectConfirmBrand: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  collectConfirmLogo: { width: 44, height: 44, borderRadius: 22 },
  collectConfirmBrandName: { fontSize: UI_FONT.title, lineHeight: 25, fontWeight: '800', marginLeft: 6 },
  collectConfirmText: { color: UI_COLORS.text, fontSize: UI_FONT.action, lineHeight: 23, fontWeight: '800' },
  collectConfirmAmount: { color: UI_COLORS.text, fontSize: UI_FONT.action, lineHeight: 23, fontWeight: '800', marginTop: 16 },
  collectConfirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 20, paddingHorizontal: 16 },
  collectConfirmNo: { minWidth: 90, minHeight: 42, paddingHorizontal: 18, borderWidth: 1.5, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  collectConfirmNoText: { fontSize: UI_FONT.action, lineHeight: 21, fontWeight: '800' },
  collectConfirmYes: { minWidth: 90, minHeight: 42, paddingHorizontal: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  collectConfirmYesText: { color: UI_COLORS.surface, fontSize: UI_FONT.action, lineHeight: 21, fontWeight: '800' },
  receiptSection: { paddingTop: 10 },
  successText: { color: UI_COLORS.success, fontSize: UI_FONT.action, fontWeight: '800', marginBottom: 3 },
  receiptNumber: { fontSize: UI_FONT.body, fontWeight: '800', color: UI_COLORS.secondaryText, marginBottom: 5 },
  receiptAction: { height: 52, borderWidth: 1, borderColor: DEFAULT_PRIMARY_COLOR, borderRadius: 16, flexDirection: 'row', overflow: 'hidden' },
  collectAgainButton: { borderRadius: 15, minHeight: 48, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12, elevation: 2 },
  printAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 15 },
  printActionText: { color: DEFAULT_PRIMARY_COLOR, fontSize: UI_FONT.action, fontWeight: '800' },
  whatsappAction: { width: 50, alignItems: 'center', justifyContent: 'center' },
  referenceBottomNav: { marginHorizontal: 16, marginTop: 8, borderTopWidth: 1.5, borderTopColor: DEFAULT_PRIMARY_COLOR, backgroundColor: 'transparent', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: 8 },
  referenceNavItem: { alignItems: 'center', minWidth: 80 },
  referenceNavIcon: { color: '#111', fontSize: 30, fontWeight: '800', lineHeight: 32 },
  referenceNavLabel: { color: UI_COLORS.text, fontSize: UI_FONT.body, fontWeight: '800' },
  phoneModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  phoneModalKeyboardArea: { flex: 1, justifyContent: 'flex-end' },
  phoneModalCard: { backgroundColor: UI_COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, maxHeight: '90%' },
  phoneModalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#D4D4D4', marginBottom: 18 },
  phoneModalTitle: { color: UI_COLORS.text, fontSize: UI_FONT.heading, fontWeight: '800', textAlign: 'center', marginBottom: 18 },
  phoneModalInput: { borderWidth: 1.5, borderColor: UI_COLORS.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: UI_FONT.heading, color: UI_COLORS.text, backgroundColor: UI_COLORS.surface },
  fetchContactsButton: { alignItems: 'center', paddingVertical: 16 },
  fetchContactsText: { color: DEFAULT_PRIMARY_COLOR, fontSize: UI_FONT.body, fontWeight: '800', letterSpacing: 1 },
  phoneModalCancelButton: { alignItems: 'center', paddingTop: 16 },
  phoneModalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 18, gap: 18 },
  phoneModalCancel: { color: DEFAULT_PRIMARY_COLOR, fontSize: UI_FONT.action, fontWeight: '800' },
  phoneModalSave: { backgroundColor: DEFAULT_PRIMARY_COLOR, borderRadius: 18, minWidth: 82, paddingVertical: 10, alignItems: 'center' },
  phoneModalSaveText: { color: UI_COLORS.surface, fontSize: UI_FONT.action, fontWeight: '800' },
  printerModalCard: { width: '100%', backgroundColor: UI_COLORS.surface, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, maxHeight: '78%' },
  printerModalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#D4D4D4', marginBottom: 16 },
  printerStatusRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  printerStatusText: { flex: 1, fontSize: UI_FONT.body, fontWeight: '800' },
  printerProgressTrack: { height: 3, overflow: 'hidden', backgroundColor: '#D8F4EF', marginBottom: 16 },
  printerProgressBar: { width: '32%', height: '100%' },
  printerDeviceList: { paddingHorizontal: 4, paddingBottom: 4 },
  printerDeviceRow: { backgroundColor: UI_COLORS.surface, borderRadius: 5, padding: 12, marginBottom: 8, elevation: 3, shadowColor: UI_COLORS.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.14, shadowRadius: 3 },
  printerDeviceName: { color: UI_COLORS.text, fontSize: UI_FONT.body, fontWeight: '800' },
  printerDeviceAddress: { color: UI_COLORS.secondaryText, fontSize: UI_FONT.caption, marginTop: 4 },
  printerModalCancel: { alignSelf: 'flex-end', paddingHorizontal: 8, paddingTop: 8 },
  receiptsHeader: { paddingTop: 4, paddingBottom: 4 },
  receiptsList: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 8 },
  receiptListCard: { backgroundColor: UI_COLORS.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginHorizontal: 2, marginBottom: 8, borderWidth: 1, borderColor: '#E8EAF0', elevation: 2, shadowColor: UI_COLORS.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  receiptListTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  receiptListMeta: { flex: 1, color: UI_COLORS.secondaryText, fontSize: UI_FONT.caption, paddingRight: 8 },
  receiptListDate: { flexShrink: 0, color: UI_COLORS.secondaryText, fontSize: 11, textAlign: 'right' },
  receiptListName: { color: UI_COLORS.text, fontSize: UI_FONT.body, fontWeight: '800', marginTop: 3 },
  receiptListAccount: { color: UI_COLORS.secondaryText, fontSize: UI_FONT.caption, marginTop: 3 },
  receiptListBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptListAmount: { color: DEFAULT_PRIMARY_COLOR, fontSize: UI_FONT.body, fontWeight: '800' },
  receiptListError: { color: UI_COLORS.error, fontSize: UI_FONT.caption, marginTop: 5 },
});

export default CollectionScreen;
