import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { DEFAULT_PRIMARY_COLOR, UI_COLORS, UI_FONT } from '../utils/theme';

const ErrorDialog = ({ visible, message, onClose, primaryColor = DEFAULT_PRIMARY_COLOR }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <View style={styles.errorDialog}>
          <View style={styles.dialogBrandRow}>
            <Image source={require('../assets/images/logo.png')} style={styles.dialogLogo} />
            <Text style={[styles.dialogBrand, { color: primaryColor }]}>Pygma</Text>
          </View>
          <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageContent}>
            <Text style={styles.dialogMessage}>{message}</Text>
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" style={[styles.dialogButton, { backgroundColor: primaryColor }]} onPress={onClose}>
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
    paddingHorizontal: 20,
  },
  errorDialog: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '72%',
    backgroundColor: UI_COLORS.surface,
    padding: 16,
    paddingBottom: 18,
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  dialogBrandRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  dialogLogo: { width: 44, height: 44, borderRadius: 22 },
  dialogBrand: { fontSize: UI_FONT.title, fontWeight: '800', marginLeft: 6 },
  messageScroll: { flexGrow: 0 },
  messageContent: { paddingVertical: 10 },
  dialogMessage: { color: UI_COLORS.text, fontSize: UI_FONT.action, fontWeight: '800', lineHeight: 23 },
  dialogButton: {
    alignSelf: 'flex-end',
    minWidth: 90,
    borderRadius: 16,
    minHeight: 42,
    paddingHorizontal: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  dialogButtonText: { color: UI_COLORS.surface, fontSize: UI_FONT.action, fontWeight: '800', letterSpacing: 0.5 },
});

export default ErrorDialog;
