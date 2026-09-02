import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApiService from '../services/ApiService';
import DatabaseService from '../database/DatabaseService';
import ConnectivityService from '../services/ConnectivityService';
import Svg, { Path } from 'react-native-svg';
import ErrorDialog from '../components/ErrorDialog';
import { getPrimaryColor } from '../utils/theme';

// Matches Android drawable/ic_call.xml used beside the bank contact number.
const BankCallIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden>
    <Path
      fill="#FFFFFF"
      d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99Z"
    />
  </Svg>
);

// Matches fragment_dashboard.xml (bg_top_mask: white bg, blue block with
// 60dp bottom-rounded corners) + DashboardViewModel.java text/logic exactly:
// Top: bank circle image, bank name/address/contact(call icon)
// cardUser: agent circle image, agent name, agent ID | mobile, Logout
// cardCollection: "Collection Summary", total collection amount, divider,
//   Confirmed Settlement | Pending Settlement | Pending To Submit,
//   status badge (Open/Live/Submitted), Accounts collected/total
// buttonLayout: Download (blue) -> Start Collection (white outline) ->
//   Continue (blue) -> Submit (white outline), "Powered By UNIGS Pygma"
const DashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Android CollectionStatus values: <2 = Open, 2 = Live, >=3 = Submitted.
  const [collectionStatus, setCollectionStatus] = useState(0);
  const [hasDownloadedAccounts, setHasDownloadedAccounts] = useState(false);
  const [validation, setValidation] = useState(null);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [bankImageFailed, setBankImageFailed] = useState(false);
  const [agentImageFailed, setAgentImageFailed] = useState(false);
  const [showSubmitSheet, setShowSubmitSheet] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState({ amount: 0, transactions: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [showDownloadSuccess, setShowDownloadSuccess] = useState(false);
  const [downloadedAccountCount, setDownloadedAccountCount] = useState(0);
  const resolveImageUrl = (value) => {
    if (!value || typeof value !== 'string') return null;
    const link = value.trim();
    if (!link) return null;
    // The API currently returns logo links on http://api.unigs.in. Android
    // loads those directly, but iOS App Transport Security blocks HTTP.
    // This host supports HTTPS (verified for both bank and agent images).
    if (/^http:\/\/api\.unigs\.in\//i.test(link)) {
      return link.replace(/^http:/i, 'https:');
    }
    if (/^(https?:|data:image\/)/i.test(link)) return link;
    return `https://pygmaapi.unigs.in/${link.replace(/^\/+/, '')}`;
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchDashboardData);
    fetchDashboardData();
    return unsubscribe;
  }, [navigation]);

  useEffect(() => ConnectivityService.subscribe(() => fetchDashboardData()), []);

  useEffect(() => {
    setBankImageFailed(false);
  }, [user?.BankImageLink, user?.bankImageLink]);

  useEffect(() => {
    setAgentImageFailed(false);
  }, [user?.AgentImageLink, user?.agentImageLink]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      // Refresh the authenticated society/agent profile before reading the
      // local cache. This is the Android flow's getloggedagentdetail call.
      try {
        const profileResponse = await ApiService.getAgentInfo();
        if (!profileResponse.success) {
          throw new Error(profileResponse.message || 'Unable to load agent details');
        }
      } catch (profileError) {
        // Android opens Dashboard from its local database while offline and
        // queues the profile refresh for ApiSyncWorker. Do the same when a
        // cached user exists; only fail if there is no offline session.
        const cachedUser = await DatabaseService.getUser();
        if (!cachedUser) throw profileError;
        console.log('Dashboard using offline cache:', profileError.message || profileError);
      }
      const userData = await DatabaseService.getUser();
      setUser(userData);

      // Dashboard totals are derived from the API-backed user and downloaded
      // account records. There is no getDashboardSummary endpoint in the API.
      const accounts = await DatabaseService.getAccounts();
      await DatabaseService.migrateLegacyTransactionSyncStates();
      const transactions = await DatabaseService.getTransactions();
      const currentValidation = await DatabaseService.getLatestValidation();
      setHasDownloadedAccounts(accounts.length > 0);
      setValidation(currentValidation);
      const apiCollectionStatus = Number(userData?.CollectionStatus) || 0;
      // The server is authoritative for Live/Submitted. Downloading accounts
      // is the only local transition (Open -> downloaded/Open); local
      // transactions must never turn an API Open collection into Live.
      const localStatus = apiCollectionStatus >= 2
        ? apiCollectionStatus
        : (accounts.length > 0 ? 1 : 0);
      setCollectionStatus(localStatus);
      const confirmedAmount = Number(userData?.SettledConfirmed) || 0;
      const pendingAmount = Number(userData?.SettledUnconfirmed) || 0;
      const localAmount = transactions.reduce((total, transaction) => total + (Number(transaction.Amount) || 0), 0);
      // Android's Submitted/Live card uses TransactionDao.getTotalCollection,
      // which represents only the active local collection. Settlement amounts
      // belong to the separate monthly summary calculation. Do not surface an
      // orphaned transaction amount when no account cycle is downloaded/live.
      const currentCycleAmount = accounts.length > 0 || apiCollectionStatus === 2
        ? localAmount
        : 0;
      const pendingTransactions = transactions.filter((transaction) =>
        Number(transaction.syncStatus ?? transaction.SyncStatus) === 0
      ).length;
      const uploadedTransactions = Math.max(transactions.length - pendingTransactions, 0);
      setPendingUploadCount(pendingTransactions);
      const collectedAccounts = accounts.filter((account) =>
        Number(account.collectionCount ?? account.CollectionCount) > 0
      ).length;
      setSummary({
        // Matches DashboardViewModel.refreshCalculations(): confirmed and
        // unconfirmed server settlements plus the local collection amount.
        totalCollections: confirmedAmount + pendingAmount + localAmount,
        confirmedAmount,
        pendingAmount,
        pendingSubmit: currentCycleAmount,
        totalTransactions: transactions.length,
        uploadedTransactions,
        pendingTransactions,
        collectedAccounts,
        totalAccounts: accounts.length,
      });
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load dashboard data');
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
    setIsRefreshing(false);
  }, []);

  const handleLogout = async () => {
    // Android's DashboardFragment has no logout implementation. Do not let a
    // live collection discard its only resumable local session; the server
    // rejects a new OTP login until that collection is submitted.
    if (collectionStatus === 2) {
      Alert.alert('Collection in progress', 'Submit the current collection before logging out.');
      return;
    }
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            await ApiService.logout();
            navigation.reset({ index: 0, routes: [{ name: 'MobileNumber' }] });
          } catch (error) {
            setErrorMessage('Failed to logout');
            setShowError(true);
          }
        },
      },
    ]);
  };

  const handleDownloadAccounts = async () => {
    setIsLoading(true);
    try {
      const accountsResponse = await ApiService.getAccounts();
      if (!accountsResponse.success) throw new Error(accountsResponse.message || 'Failed to download accounts');
      await DatabaseService.insertUser({ ...user, CollectionStatus: 1 });
      setUser((current) => ({ ...current, CollectionStatus: 1 }));
      setHasDownloadedAccounts(true);
      setCollectionStatus(1);
      setValidation(accountsResponse.validation || null);
      // We deliberately do not refresh getloggedagentdetail here because it
      // can replace the downloaded-list timestamp. Update the same dashboard
      // state locally instead, so Android's Accounts 0/<downloaded> summary
      // appears immediately after Download succeeds.
      setSummary((current) => ({
        ...current,
        totalCollections: 0,
        pendingSubmit: 0,
        collectedAccounts: 0,
        totalAccounts: accountsResponse.data.length,
      }));
      setDownloadedAccountCount(accountsResponse.data.length);
      setShowDownloadSuccess(true);
    } catch (error) {
      setErrorMessage(error.message || 'Failed to download accounts');
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCollection = async () => {
    setIsLoading(true);
    try {
      // Android sends Validation.AccountUpdateTimeFlag. A device timestamp is
      // not accepted by this endpoint, so never substitute Date.now().
      const downloadedTimeFlag = await ApiService.getDownloadedAccountsTimeFlag();
      const timeFlag = String(
        downloadedTimeFlag
        ?? validation?.AccountUpdateTimeFlag
        ?? validation?.accountUpdateTimeFlag
        ?? ''
      ).trim();
      // AccountUpdateTimeFlag is a Java long (often > Number.MAX_SAFE_INTEGER).
      // Keep it as digits to avoid any JavaScript rounding before posting it.
      if (!/^\d+$/.test(timeFlag)) {
        throw new Error('Account data is missing. Download accounts again before starting collection.');
      }
      const response = await ApiService.startCollection(timeFlag);
      if (!response.success) throw new Error(response.message || 'Unable to start collection');
      const serverStatus = Number(response.data?.CollectionStatus ?? response.data?.collectionStatus) || 2;
      const restoredTransactions = response.data?.TranList ?? response.data?.tranList ?? [];
      await DatabaseService.updateValidationAfterStart(timeFlag, response.data || {});
      for (const transaction of restoredTransactions) {
        await DatabaseService.insertTransaction({
          ...transaction,
          TransactionId: transaction.TransactionId ?? transaction.transactionId ?? String(transaction.TranNumber ?? transaction.tranNumber),
          AccountId: transaction.AccountId ?? transaction.accountID ?? transaction.accountId,
          Amount: transaction.Amount ?? transaction.amount ?? 0,
          TransactionDate: transaction.TransactionDate ?? transaction.tranDate ?? new Date().toISOString(),
          ReceiptNumber: transaction.ReceiptNumber ?? transaction.receiptNumber ?? null,
          // Transactions returned by startcollection already exist on the
          // server; retain an explicit server-provided status when present.
          syncStatus: transaction.syncStatus ?? transaction.SyncStatus ?? 1,
          SyncStatus: transaction.syncStatus ?? transaction.SyncStatus ?? 1,
        });
      }
      await DatabaseService.insertUser({ ...user, CollectionStatus: serverStatus });
      setUser((current) => ({ ...current, CollectionStatus: serverStatus }));
      setCollectionStatus(serverStatus);
      navigation.navigate('Collection');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to start collection. Please try again.');
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueCollection = () => {
    navigation.navigate('Collection');
  };

  const handleSubmitCollection = async () => {
    // Android does not submit while locally queued transaction uploads remain.
    const pendingTransactions = await ApiService.getPendingTransactionCount();
    setPendingUploadCount(pendingTransactions);
    if (pendingTransactions > 0) {
      ApiService.syncOfflineQueue().finally(fetchDashboardData);
      const label = pendingTransactions === 1 ? 'transaction is' : 'transactions are';
      Alert.alert('Pending uploads', `${pendingTransactions} ${label} pending upload. Please try again once upload completes.`);
      return;
    }
    setShowSubmitSheet(true);
  };

  const confirmSubmitCollection = async () => {
    setShowSubmitSheet(false);
    try {
      // Check again at the point of submission. This closes the race where the
      // dashboard was opened before a collection was saved locally.
      const pendingTransactions = await ApiService.getPendingTransactionCount();
      if (pendingTransactions > 0) {
        setPendingUploadCount(pendingTransactions);
        Alert.alert('Pending uploads', 'All collected transactions must be synced before submitting.');
        return;
      }
      // Keep the exact local submission totals before submitCollection clears
      // the active collection. These are also the fallback when older API
      // versions omit totals from SubmitResponse.
      const submittedTransactionsSnapshot = await DatabaseService.getTransactions();
      const localSubmittedAmount = submittedTransactionsSnapshot.reduce(
        (total, transaction) => total + (Number(transaction.Amount ?? transaction.amount) || 0),
        0,
      );
      const localSubmittedCount = submittedTransactionsSnapshot.length;
      const response = await ApiService.submitCollection();
      if (!response.success) throw new Error(response.message || 'Unable to submit collection');
      // Android displays SubmitResponse values, not a local total (the local
      // transactions are deleted immediately after a successful submission).
      const submitData = response.data || {};
      const submittedAmount = Number(
        submitData.SubmittedAmount
        ?? submitData.submittedAmount
        ?? submitData.TotalAmount
        ?? submitData.totalAmount
        ?? submitData.TotalCollection
        ?? submitData.totalCollection
        ?? localSubmittedAmount
      );
      const submittedTransactions = Number(
        submitData.SubmittedTranCount
        ?? submitData.submittedTranCount
        ?? submitData.TotalTranCount
        ?? submitData.totalTranCount
        ?? submitData.TotalReceipt
        ?? submitData.totalReceipt
        ?? submitData.ReceiptCount
        ?? submitData.receiptCount
        ?? localSubmittedCount
      );
      const submittedStatus = Number(submitData.CollectionStatus ?? submitData.collectionStatus ?? 3) || 3;
      setSubmittedSummary({ amount: submittedAmount, transactions: submittedTransactions });
      await DatabaseService.deleteAllAccounts();
      await DatabaseService.deleteAllTransactions();
      await DatabaseService.insertUser({ ...user, CollectionStatus: submittedStatus });
      setUser((current) => ({ ...current, CollectionStatus: submittedStatus }));
      setCollectionStatus(submittedStatus);
      setShowSubmitSuccess(true);
      fetchDashboardData();
    } catch (error) {
      // Android never queues submitcollection: it keeps the local collection
      // open until every transaction is uploaded and submit succeeds.
      setErrorMessage(error.message || 'Unable to submit collection. Please try again when online.');
      setShowError(true);
    }
  };

  const formatINR = (val) => `₹ ${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const bankImageUrl = resolveImageUrl(user?.BankImageLink || user?.bankImageLink);
  const agentImageUrl = resolveImageUrl(user?.AgentImageLink || user?.agentImageLink);
  const primaryColor = getPrimaryColor(user);
  // Android enables Continue and Submit in the Live state when the server's
  // validation limits are valid. Older local installs do not have that record,
  // so retain the requested Collect/Submit flow until the next download.
  const maxReceipts = validation?.MaxReceiptsCount ?? validation?.maxReceiptsCount;
  const maximumAmount = validation?.MaximumAmount ?? validation?.maximumAmount;
  const hasValidCollectionLimits = maxReceipts === undefined || maximumAmount === undefined
    || (Number(maxReceipts) > 0 && Number(maximumAmount) >= 0);

  if (isLoading && !user) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={primaryColor} />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} />

      {/* rootLayout - bg_top_mask: blue block, 60dp bottom-rounded corners */}
      <View style={[styles.topMask, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View
          style={[
            styles.bankRow,
            { backgroundColor: primaryColor },
            { marginTop: -insets.top, paddingTop: insets.top + 28 },
          ]}
        >
          <Image
            style={styles.bankImage}
            source={bankImageUrl && !bankImageFailed
              ? { uri: bankImageUrl }
              : require('../assets/images/logo.png')}
            onError={() => setBankImageFailed(true)}
          />
          <View style={styles.bankInfo}>
            <Text style={styles.bankName}>{user?.BankName || user?.BankShortName || ''}</Text>
            <Text style={styles.bankAddress}>{user?.BankAddress || ''}</Text>
            {user?.ContactNumber ? (
              <View style={styles.bankContactRow}>
                <BankCallIcon />
                <Text style={styles.bankContact}>{user.ContactNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Modal visible={showDownloadSuccess} transparent animationType="fade" onRequestClose={() => setShowDownloadSuccess(false)}>
          <View style={styles.dialogOverlay}>
            <View style={styles.successDialog}>
              <View style={styles.dialogBrandRow}>
                <Image source={require('../assets/images/logo.png')} style={styles.dialogLogo} />
                <Text style={[styles.dialogBrand, { color: primaryColor }]}>Pygma</Text>
              </View>
              <Text style={styles.dialogMessage}>{downloadedAccountCount} accounts downloaded successfully</Text>
              <TouchableOpacity style={[styles.dialogOkay, { backgroundColor: primaryColor }]} onPress={() => setShowDownloadSuccess(false)}>
                <Text style={styles.dialogOkayText}>Okay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showSubmitSuccess} transparent animationType="fade" onRequestClose={() => setShowSubmitSuccess(false)}>
          <View style={styles.dialogOverlay}>
            <View style={styles.successDialog}>
              <View style={styles.dialogBrandRow}>
                <Image source={require('../assets/images/logo.png')} style={styles.dialogLogo} />
                <Text style={[styles.dialogBrand, { color: primaryColor }]}>Pygma</Text>
              </View>
              <Text style={styles.dialogMessage}>Collection submitted successfully{`\n`}Total Amount {formatINR(submittedSummary.amount)}{`\n`}Total Transactions {submittedSummary.transactions}</Text>
              <TouchableOpacity style={[styles.dialogOkay, { backgroundColor: primaryColor }]} onPress={() => setShowSubmitSuccess(false)}>
                <Text style={styles.dialogOkayText}>Okay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ErrorDialog visible={showError} message={errorMessage} primaryColor={primaryColor} onClose={() => setShowError(false)} />

        <Modal visible={showSubmitSheet} transparent animationType="slide" onRequestClose={() => setShowSubmitSheet(false)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.submitSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetTitleRow}>
                <Text style={styles.sheetTitle}>Submit Collection</Text>
                <TouchableOpacity
                  style={styles.sheetCloseTouchTarget}
                  onPress={() => setShowSubmitSheet(false)}
                  accessibilityLabel="Close submit confirmation"
                >
                  <Text style={styles.sheetClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sheetLine}>Total Receipt    <Text style={styles.sheetValue}>{summary?.totalTransactions || 0}</Text></Text>
              <Text style={styles.sheetLine}>Total Amount     <Text style={styles.sheetValue}>{formatINR(summary?.pendingSubmit)}</Text></Text>
              <Text style={styles.sheetLine}>Total Account    <Text style={styles.sheetValue}>{summary?.totalAccounts || 0}</Text></Text>
              <Text style={styles.sheetLine}>Collected        <Text style={styles.sheetValue}>{summary?.collectedAccounts || 0}</Text></Text>
              <Text style={styles.sheetLine}>Pending          <Text style={styles.sheetValue}>{(summary?.totalAccounts || 0) - (summary?.collectedAccounts || 0)}</Text></Text>
              <TouchableOpacity style={[styles.sheetSubmitButton, { backgroundColor: primaryColor }]} onPress={confirmSubmitCollection}>
                <Text style={styles.primaryButtonText}>Submit {formatINR(summary?.pendingSubmit)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ScrollView
          style={styles.scrollArea}
          refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primaryColor} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { shadowColor: primaryColor }]}>
            <View style={styles.userSection}>
              <Image
                style={styles.userImage}
                source={agentImageUrl && !agentImageFailed
                  ? { uri: agentImageUrl }
                  : require('../assets/images/logo.png')}
                onError={() => setAgentImageFailed(true)}
              />
              <Text style={styles.userName}>{user?.AgentName || ''}</Text>
              <Text style={styles.userIdRow}>ID #{user?.AgentID || ''} | {user?.MobileNumber || ''}</Text>
            </View>
            <View style={[styles.transactionSummary, { borderColor: primaryColor }]}>
              <Text style={[styles.statusStrip, { backgroundColor: primaryColor }]}>
                {collectionStatus < 2 ? 'Open' : collectionStatus === 2 ? 'Live' : 'Submitted'}
              </Text>
              <View style={styles.bottomStatsRow}>
                <View style={styles.bottomStatItem}>
                  <Text style={styles.statValue}>{formatINR(summary?.pendingSubmit)}</Text>
                  <Text style={styles.statLabelSmall}>Amount</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: primaryColor, shadowColor: primaryColor }]} />
                <View style={styles.bottomStatItem}>
                  <Text style={styles.statValue}>{summary?.collectedAccounts || 0}/{summary?.totalAccounts || 0}</Text>
                  <Text style={styles.statLabelSmall}>Accounts</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* buttonLayout */}
        <View style={styles.buttonLayout}>
          {/* Android hides Download only during a live collection. A submitted
              collection must show Download so the next collection can begin. */}
          {collectionStatus !== 2 && (
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primaryColor }]} onPress={handleDownloadAccounts}>
              <Text style={styles.primaryButtonText}>
                {collectionStatus === 3 ? 'Download' : (hasDownloadedAccounts ? 'Download Again' : 'Download')}
              </Text>
            </TouchableOpacity>
          )}
          {collectionStatus < 2 && hasDownloadedAccounts
            && Number(validation?.LastRefreshTimeFlag ?? validation?.lastRefreshTimeFlag ?? 0) === 0 && (
            <TouchableOpacity style={[styles.outlineButton, { borderColor: primaryColor }]} onPress={handleStartCollection}>
              <Text style={[styles.outlineButtonText, { color: primaryColor }]}>Collect</Text>
            </TouchableOpacity>
          )}
          {collectionStatus === 2 && hasValidCollectionLimits && (
            <>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primaryColor }]} onPress={handleContinueCollection}>
                <Text style={styles.primaryButtonText}>Collect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.outlineButton, { borderColor: primaryColor }]} onPress={handleSubmitCollection}>
                <Text style={[styles.outlineButtonText, { color: primaryColor }]}>Submit</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.poweredByRow}>
            <Text style={styles.poweredByLabel}>Powered By </Text>
            <Text style={[styles.poweredByValue, { color: primaryColor }]}>UNIGS Pygma</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  successDialog: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  dialogBrandRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E7EEF3' },
  dialogLogo: { width: 40, height: 40, borderRadius: 20 },
  dialogBrand: { color: '#2874B2', fontSize: 20, fontWeight: '700', marginLeft: 6 },
  dialogMessage: { color: '#17324D', fontSize: 16, lineHeight: 23, marginVertical: 16 },
  dialogOkay: { alignSelf: 'center', minWidth: 120, backgroundColor: '#2874B2', borderRadius: 8, minHeight: 44, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  dialogOkayText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(16,37,54,0.52)', justifyContent: 'flex-end' },
  submitSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30, elevation: 10 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#C9D5DE', marginBottom: 18 },
  sheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  sheetTitle: { color: '#17324D', fontSize: 21, fontWeight: '700' },
  sheetCloseTouchTarget: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sheetClose: { color: '#657789', fontSize: 20, fontWeight: '500', lineHeight: 24 },
  sheetLine: { color: '#657789', fontSize: 15, marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEF3F6' },
  sheetValue: { color: '#17324D', fontWeight: '700' },
  sheetSubmitButton: { backgroundColor: '#2874B2', borderRadius: 10, minHeight: 52, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  // The reference dashboard uses a white page with a purple header mask.
  topMask: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingTop: 0,
    paddingBottom: 26,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: -28,
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 62,
    backgroundColor: '#2874B2',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  bankImage: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#FFFFFF',
    resizeMode: 'contain',
  },
  bankInfo: {
    flex: 1,
    marginLeft: 14,
  },
  bankName: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bankAddress: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  bankContact: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  bankContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  scrollArea: {
    flex: 1,
    marginTop: -34,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    margin: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  summaryCard: {
    marginTop: -8,
    paddingTop: 0,
    shadowOpacity: 0.18,
  },
  statusStrip: {
    backgroundColor: '#7F7BF4',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 7,
  },
  transactionSummary: {
    marginTop: 14,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  statDivider: {
    width: 1.5,
    alignSelf: 'stretch',
    marginVertical: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 4,
    elevation: 2,
  },
  userSection: {
    alignItems: 'center',
  },
  userImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    resizeMode: 'contain',
  },
  userName: {
    fontSize: 18, // Heading3
    color: '#000000',
    marginTop: 5,
  },
  userIdRow: {
    fontSize: 14, // TextNormal
    color: '#808080',
    marginTop: 5,
  },
  logoutRow: {
    marginVertical: 10,
    display: 'none',
  },
  logoutText: {
    fontSize: 18,
    color: '#FF0000',
    fontWeight: '600',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    display: 'none',
  },
  summaryAmount: {
    fontSize: 20, // Heading2
    color: '#000000',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
    display: 'none',
  },
  summarySubLabel: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
    display: 'none',
  },
  divider: {
    height: 1.5,
    backgroundColor: '#EEEEEE',
    marginVertical: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
    display: 'none',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 14,
    color: '#808080',
  },
  statLabelSmall: {
    fontSize: 12,
    color: '#808080',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16, // TextBig
    color: '#000000',
    fontWeight: '600',
  },
  bottomStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 5,
    paddingTop: 10,
    paddingBottom: 10,
  },
  bottomStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  statusBadge: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: '#7F7BF4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusLive: {
    backgroundColor: '#006400', // green
  },
  statusOpen: {
    backgroundColor: '#FF9800', // orange
  },
  buttonLayout: {
    marginTop: 8,
    paddingHorizontal: 0,
  },
  primaryButton: {
    backgroundColor: '#2874B2',
    borderRadius: 10,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2874B2',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  outlineButtonText: {
    color: '#2874B2',
    fontSize: 16,
    fontWeight: '600',
  },
  poweredByRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  poweredByLabel: {
    fontSize: 14,
    color: '#808080',
  },
  poweredByValue: {
    fontSize: 14,
    color: '#2874B2',
    fontWeight: '700',
  },
});

export default DashboardScreen;
