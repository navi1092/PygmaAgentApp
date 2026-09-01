import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';

const ErrorDialog = ({ visible, message, onClose, title = 'Error', primaryColor = '#2874B2' }) => {
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    minHeight: 300,
    borderRadius: 20,
    elevation: 8,
  },
  dialogBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E7EEF3',
  },
  dialogLogo: { width: 48, height: 48, borderRadius: 24 },
  dialogBrand: { color: '#2874B2', fontSize: 24, fontWeight: '700', marginLeft: 10 },
  dialogMessage: { color: '#17324D', fontSize: 18, lineHeight: 27, marginTop: 22 },
  dialogButton: {
    alignSelf: 'stretch',
    backgroundColor: '#2874B2',
    borderRadius: 10,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  dialogButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default ErrorDialog;
