import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';

const ErrorDialog = ({ visible, message, onClose, primaryColor = '#2874B2' }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <View style={styles.errorDialog}>
          <View style={styles.dialogBrandRow}>
            <Image source={require('../assets/images/logo.png')} style={styles.dialogLogo} />
            <Text style={[styles.dialogBrand, { color: primaryColor }]}>Pygma</Text>
          </View>
          <Text style={styles.dialogMessage}>{message}</Text>
          <TouchableOpacity style={[styles.dialogButton, { backgroundColor: primaryColor }]} onPress={onClose}>
            <Text style={styles.dialogButtonText}>Okay</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  errorDialog: {
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
  dialogBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E7EEF3',
  },
  dialogLogo: { width: 40, height: 40, borderRadius: 20 },
  dialogBrand: { color: '#2874B2', fontSize: 20, fontWeight: '700', marginLeft: 6 },
  dialogMessage: { color: '#17324D', fontSize: 16, lineHeight: 23, marginVertical: 16 },
  dialogButton: {
    alignSelf: 'center',
    minWidth: 120,
    backgroundColor: '#2874B2',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  dialogButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default ErrorDialog;
