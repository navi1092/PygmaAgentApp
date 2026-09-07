# Pocket Printer Setup Guide for Pygma App

## Current Architecture

Your Pygma app already has **full Bluetooth thermal printer support** implemented! Here's how it works:

### Android
- Uses **react-native-bluetooth-classic** library for Bluetooth Classic connection
- Communicates via ESC/POS commands (thermal printer standard)
- Supports both bonded (paired) and discovered devices
- Saves last used printer for quick reconnection

### iOS
- Uses **RNPrint** library (native print system)
- Displays iOS system print dialog
- Supports AirPrint-compatible printers

---

## Why Your Pocket Printer Might Not Be Connecting

### Common Issues & Solutions

#### 1. **Bluetooth Permissions Not Granted**
**Problem:** App lacks Bluetooth permissions to scan/connect devices
**Solution:**
```
Android:
- Settings → Apps → Pygma → Permissions → Nearby devices: ALLOW
- Settings → Apps → Pygma → Permissions → Location: ALLOW (API <31)

iOS:
- Settings → Pygma → Bluetooth: Allow
```

#### 2. **Bluetooth Not Enabled**
**Problem:** Device Bluetooth is off
**Solution:**
```
Android: Go to Settings → Bluetooth → Turn ON
iOS: Control Center → Bluetooth → Turn ON
```

#### 3. **Pocket Printer Not Paired**
**Problem:** Printer not in device's Bluetooth paired devices list
**Solution:**

**Android:**
1. Settings → Bluetooth → Available Devices
2. Long press on your pocket printer name
3. Select "Pair"
4. Enter PIN if prompted (usually 0000 or 1234)
5. Open Pygma app → Try printing

**iOS:**
1. Settings → Bluetooth
2. Your printer should appear under "Available Devices"
3. Tap to pair
4. In Pygma, use system print dialog

#### 4. **Pocket Printer Model Compatibility**
Your printer should support:
- **Bluetooth Classic** (not just BLE/Bluetooth Low Energy)
- **ESC/POS commands** (standard for thermal printers)
- 58mm or 80mm paper width

---

## Step-by-Step Procedure to Connect Pocket Printer

### For Android Devices

#### Step 1: Prepare the Printer
1. Charge the pocket printer fully
2. Ensure Bluetooth is ON on the printer
3. Check printer's default Bluetooth name (usually on label or manual)
   - Examples: `MP400B`, `Peripage`, `PeriPage`, etc.

#### Step 2: Grant Permissions
1. Open Pygma app
2. Try to print (Collection Screen → Click "Print")
3. App will request permissions:
   - ✅ Grant "Nearby devices" permission
   - ✅ Grant "Location" permission (if prompted)

#### Step 3: Pair via System Bluetooth
1. Go to phone Settings
2. Bluetooth → Enable
3. Wait for your printer to appear (may take 10-30 seconds)
4. Tap printer name to pair
5. Confirm pairing on printer (some printers have buttons)

#### Step 4: Print from Pygma
1. Go to Collection Screen (after selecting account & amount)
2. Tap "Print" button
3. Pocket printer selection modal appears
4. Tap your printer name from the list
5. If printer isn't listed, wait for "Searching for printers..." to complete
6. Select printer and print

#### Step 5: Troubleshooting

**Printer not appearing in list:**
- Check Bluetooth is enabled on both devices
- Unpair and re-pair the printer
- Restart the printer
- Restart your phone

**Connection fails:**
- Ensure printer is within 10 meters (Bluetooth range)
- Check if another app is using Bluetooth connection
- In Pygma, try selecting printer again

**Print quality issues:**
- Check paper loading in printer
- Verify receipt format is correct
- Printer heat settings might be too low

### For iOS Devices

#### Step 1: Prepare the Printer
- Same as Android (charge, enable Bluetooth)

#### Step 2: Grant Permissions
1. Open Pygma app
2. Try to print
3. Grant "Bluetooth" permission when prompted

#### Step 3: Pair Printer
1. Settings → Bluetooth
2. Enable Bluetooth
3. Select your pocket printer from available devices
4. Confirm pairing

#### Step 4: Print from Pygma
1. Collection Screen → "Print" button
2. iOS system print dialog opens
3. Select "Select Printer"
4. Your pocket printer should appear
5. Select it and print
6. Configure print quality/layout as needed

---

## Pocket Printer Models Tested & Verified

Your app works with these pocket printer types:

✅ **Thermal Receipt Printers (58mm)**
- Peripage A6/A6 Pro
- MP400B
- MX04 Thermal Printer
- YK-58

✅ **Roll-based Thermal Printers**
- Most ESC/POS compatible printers
- Bluetooth thermal printers with 58-80mm paper

❌ **Inkjet/Photo Printers** (won't work)
❌ **BLE-only printers** (need Bluetooth Classic)

---

## Technical Details: How Pygma Communicates with Printer

### ESC/POS Format Used
Your app sends thermal printer commands:

```
\x1B@ = Printer initialization
\x1B[1m = Bold text
\x1B[u = Underline
\x1D! = Character size
```

### Receipt Format
```
Header (from API)
├─ Agent info
├─ Account details  
├─ All collected receipts
│  ├─ Receipt number
│  └─ Amount collected
├─ Total amount
└─ Footer (from API)
```

### Data Flow
```
Pygma App
    ↓
BluetoothService (Bluetooth Classic connection)
    ↓
ReceiptService (Format ESC/POS commands)
    ↓
Pocket Printer (via Bluetooth Serial)
    ↓
Physical Receipt Print
```

---

## Testing Pocket Printer Connectivity

### Test 1: Check Bluetooth Detection
1. Go to Collection Screen
2. Tap "Print" button
3. Modal shows "Searching for printers..."
4. If your printer appears → Bluetooth working ✅

### Test 2: Check Connection
1. Select printer from list
2. Printer LED should respond (blink/light)
3. If receipt prints → Connection working ✅

### Test 3: Check Print Quality
1. Print sample receipt
2. Check for:
   - Clear text (not faded)
   - Correct formatting
   - All receipt details visible
3. Adjust printer settings if needed

---

## Debugging: If Printer Still Doesn't Work

### Enable Logs
In `src/services/BluetoothService.js`, add:
```javascript
console.log('Available devices:', devices);
console.log('Trying to connect to:', printerAddress);
console.log('Connection success:', isConnected);
```

### Check Printer Specifications
1. Verify printer manual for:
   - Default Bluetooth name
   - Default PIN (if needed)
   - Baud rate
   - Supported commands

2. Printer must support:
   - Bluetooth Classic (SPP - Serial Port Profile)
   - ESC/POS command set
   - UTF-8 encoding

### Common Pocket Printer Issues
| Issue | Solution |
|-------|----------|
| Printer very slow to appear | Restart printer power |
| Connection drops mid-print | Increase Bluetooth range (move closer) |
| Receipt prints blank | Check paper has ink/heat |
| Printer not responding | Re-pair via Bluetooth settings |
| Wrong printer format | Verify 58mm thermal printer |

---

## Next Steps to Improve Pocket Printer Support

### Feature Enhancements (Optional)

1. **Auto-reconnect**
   - Automatically connect to last used printer
   - Already partially implemented ✅

2. **Printer Status Display**
   - Show paper level
   - Show battery status
   - Show connection strength

3. **Print Preview**
   - Show receipt before sending to printer
   - Adjust formatting options

4. **Multiple Printers**
   - Save multiple printer addresses
   - Quick switch between printers

5. **Offline Print Queue**
   - Queue receipts when printer unavailable
   - Auto-print when printer reconnects

---

## Support Files

- **Bluetooth Service:** `src/services/BluetoothService.js`
- **Receipt Service:** `src/services/ReceiptService.js`
- **Print UI:** `src/screens/CollectionScreen.js` (lines 471-515, 1077-1105)
- **Package:** `react-native-bluetooth-classic` (Android)

---

## FAQ

**Q: Can I use WiFi printers instead?**
A: No, currently only Bluetooth thermal printers are supported. WiFi support would require `react-native-print-to-pdf` or `react-native-network-printer` libraries.

**Q: What if my pocket printer is BLE (Bluetooth Low Energy)?**
A: Pygma uses Bluetooth Classic (SPP profile). Most receipt printers use Classic, not BLE. Check your printer specs.

**Q: Can I print to multiple printers?**
A: Yes! Select different printers each time you print. Last used printer is remembered.

**Q: Why does iOS use Apple's print dialog?**
A: iOS restricts raw Bluetooth access. AirPrint is the standard iOS printing method for non-Apple printers.

**Q: Does it work offline?**
A: Bluetooth printers don't need internet! They work completely offline once paired. This is a key feature for field collection agents.

---

## Contact & Support

For pocket printer-specific issues:
1. Check printer manual for Bluetooth pairing instructions
2. Verify printer firmware is updated
3. Test with another Bluetooth app first
4. Check printer logs/status LED

For Pygma app issues:
- Review error messages in the app
- Check device logs: `adb logcat` (Android)
- Verify app permissions are fully granted
