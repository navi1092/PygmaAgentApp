# Pygma Collection App

Pygma is a React Native field-collection app for agents. It authenticates by mobile number and OTP, downloads assigned accounts, supports offline collections, synchronizes transactions, submits completed collections, and prints or shares receipts.

This document describes the current repository implementation for developers, testers, and Android/iOS release engineers.

## Contents

- [Technology and requirements](#technology-and-requirements)
- [Project structure](#project-structure)
- [Complete application flow](#complete-application-flow)
- [Synchronization rules](#synchronization-rules)
- [API integration](#api-integration)
- [Local storage](#local-storage)
- [Permissions and platform differences](#permissions-and-platform-differences)
- [Install and validate](#install-and-validate)
- [Android setup and execution](#android-setup-and-execution)
- [iOS setup and execution](#ios-setup-and-execution)
- [Bluetooth and printing](#bluetooth-and-printing)
- [Release builds](#release-builds)
- [Testing checklist](#testing-checklist)
- [Troubleshooting](#troubleshooting)

## Technology and requirements

| Area | Current implementation |
|---|---|
| Framework | React Native 0.74.1 and React 18.2 |
| Navigation | React Navigation 6 |
| API | Axios |
| Database | SQLite through `react-native-sqlite-storage` |
| Key/value storage | AsyncStorage |
| Connectivity | NetInfo |
| Android printing | Bluetooth Classic and ESC/POS text |
| iOS printing | Native iOS print sheet through `react-native-print` |
| Location | `react-native-geolocation-service` |
| Contacts | `react-native-select-contact` with native fallback |
| Sharing | `react-native-share` |

Common requirements:

- Node.js 18 or newer.
- npm; this repository includes `package-lock.json`, so use `npm ci`.
- Git and internet access for dependency installation and API access.
- A physical device for final location, contacts, Bluetooth, printer, and sharing tests.
- macOS is required for iOS development.

Android requirements:

- Android Studio, SDK Platform 35, Build Tools 35.0.0, and Platform Tools.
- JDK 17.
- Minimum Android API 23; target/compile API 35.
- An emulator or USB-debuggable device.

iOS requirements:

- Xcode and CocoaPods.
- Ruby/Bundler for the checked-in `Gemfile` workflow.
- iOS 13.4 or newer.
- An Apple Developer team and owned bundle identifier for device/distribution builds.

## Project structure

```text
Pygma/
├── App.js                         Initialization, connectivity and navigation
├── src/
│   ├── screens/
│   │   ├── SplashScreen.js        Session routing
│   │   ├── MobileNumberScreen.js  Phone entry and OTP request
│   │   ├── OTPScreen.js           OTP verification
│   │   ├── DashboardScreen.js     Download/start/continue/submit
│   │   └── CollectionScreen.js    Accounts, collections and receipts
│   ├── services/
│   │   ├── ApiService.js          API, auth headers and offline upload queue
│   │   ├── ConnectivityService.js Connectivity-triggered retries
│   │   ├── BluetoothService.js    Android permission/discovery/connection
│   │   ├── ReceiptService.js      ESC/POS and printable HTML receipts
│   │   └── LocationService.js     Location permission and coordinates
│   ├── database/
│   │   ├── DatabaseService.js     SQLite operations
│   │   └── schemas.js             Table definitions
│   ├── components/                Shared components/dialogs
│   ├── assets/                    Images and vector artwork
│   └── utils/theme.js             API color conversion
├── android/                       Native Android project
└── ios/                           Native iOS project
```

## Complete application flow

### 1. Startup

1. `App.js` initializes `pygma.db`.
2. Connectivity monitoring starts.
3. `SplashScreen` checks the stored session.
4. A valid session opens Dashboard; otherwise Mobile Number opens.
5. HTTP 401 clears credentials and all local business data, then resets to Mobile Number.

### 2. Mobile number and OTP

1. Enter the registered agent mobile number.
2. The app loads app configuration and registers the device when required.
3. `Auth/getotp` sends the OTP and returns an OTP request ID.
4. On Android, the request includes the app's SMS Retriever hash. A correctly
   formatted backend SMS is securely delivered to the app without SMS-reading
   permission. On iOS, the OTP field advertises the system `oneTimeCode` type
   so the code appears in the keyboard AutoFill suggestion.
5. The ID is passed to the OTP screen and saved as a fallback.
6. Enter, paste, auto-fetch/AutoFill, or resend the OTP. Completing all six
   digits automatically starts verification after a short delay.
7. Verification can request location for login metadata.
8. `Auth/verifyotp` returns the login key, agent ID, bank ID, and configuration.
9. Credentials are stored and `Agent/getloggedagentdetail` loads agent/bank data.
10. Navigation resets to Dashboard.

The API uses custom headers, not `Authorization: Bearer`:

```text
Login-Key
AgentID
BankID
API-Version: 1.2
AppVersionId: 12
```

### 3. Dashboard states

`CollectionStatus` follows the legacy Android contract:

| Value | State | Main actions |
|---|---|---|
| `< 2` | Open/not started | Download accounts, then Start |
| `2` | Live | Continue and Submit after uploads finish |
| `>= 3` | Submitted | Show server submission result |

Dashboard totals combine server confirmed/unconfirmed settlements with locally stored collection transactions. Account totals show total, locally collected, and pending accounts.

### 4. Download accounts

1. `Agent/getaccounts` downloads accounts and validation rules.
2. The previous local account snapshot is replaced.
3. API values such as account number, balance, opening date, last transaction date, scheme code/name, phone, and coordinates are stored in SQLite.
4. The exact `AccountUpdateTimeFlag` is stored as text because it may exceed JavaScript's safe integer range.
5. Dashboard becomes ready to start.

The UI displays downloaded API values. Missing business values display `-`; the client does not invent an opening date, scheme name, balance, or last collection date.

### 5. Start or resume

1. Start sends the exact downloaded time flag to `Agent/startcollection` as raw numeric JSON text.
2. The server changes the collection to Live and may return existing transactions.
3. Returned server transactions are stored as synchronized.
4. Collection Screen opens.
5. A previously Live collection uses Continue and restores SQLite data.

### 6. Make a collection

1. Choose an account with Previous/Next, Search, or Total/Collected/Pending filters.
2. Enter an amount or use plus/minus.
3. Validation ensures the amount:
   - is not empty;
   - is numeric and greater than zero;
   - has at most two decimals;
   - fits the server date/time window;
   - does not exceed the total permitted amount;
   - does not exceed the permitted receipts per account.
4. Location permission is requested and current coordinates are captured when available. Location failure does not lose the collection; zero coordinates are used.
5. Receipt numbers use the server validation sequence and existing transactions.
6. The transaction is saved locally with `syncStatus = 0` and queued before upload is attempted.
7. The account's local collection counters update.
8. The app attempts immediate synchronization.
9. The receipt area supports Print, WhatsApp/share, View Receipts, and Collect Again.

### 7. Submit

1. Dashboard counts transactions whose `syncStatus` is zero.
2. Submit is blocked while any transaction is pending.
3. The app retries uploads and asks the user to wait/retry.
4. With zero pending items, confirmation calls `Agent/submitcollection`.
5. The server returns submitted amount, count, and final status.
6. Accounts and transactions are cleared only after successful server submission.

Logout is blocked during a Live collection so its resumable local data cannot be abandoned.

## Synchronization rules

The offline-first sequence is:

```text
Collect
  -> save transaction in SQLite as pending
  -> add Agent/updatetransaction to SQLite queue
  -> attempt upload
       -> success: mark synced and remove queue row
       -> failure: retain transaction and queue row
  -> refresh counters
```

Retries occur:

- immediately after collecting;
- when network reachability returns;
- when the app returns to the foreground;
- on screen focus/refresh;
- when Submit finds pending uploads.

The transaction's `syncStatus` is the source of truth for displayed pending counts. Queue rows are delivery records and do not add another count.

## API integration

The current URL is in `src/services/ApiService.js`:

```text
Live: https://pygmaapi.unigs.in/api/
Demo reference: https://demopygmaapi.unigs.in/api/
```

There is no `.env` environment selector. Switching servers currently requires changing `API_BASE_URL` and rebuilding.

| Endpoint | Purpose | Offline behavior |
|---|---|---|
| `App/appconfig` | Application configuration/reachability | Online only |
| `Device/register` | Register the installation | Online only |
| `Auth/getotp` | Request OTP | Online only |
| `Auth/verifyotp` | Establish the session | Online only |
| `Agent/getloggedagentdetail` | Agent, bank, theme and print config | Profile refresh can queue |
| `Agent/getaccounts` | Accounts and collection validation | Online only |
| `Agent/startcollection` | Start/resume server collection | Online only |
| `Agent/updatetransaction` | Upload a saved collection | Queued and retried |
| `Agent/updatemobilenumber` | Update account phone | Online request |
| `Agent/submitcollection` | Finalize the collection | Never queued |

Successful responses are normalized from this envelope, accepting deployed casing variations:

```json
{
  "statusCode": 200,
  "statusText": "...",
  "message": "...",
  "responseData": {}
}
```

API-controlled presentation and data:

- Primary color comes from the signed Android ARGB `BackColor`, converted to `#RRGGBB`; fallback is `#2874B2`.
- Bank/agent names, images, account details, scheme code/name, receipt headers/footers, WhatsApp template, validation limits, and status are API supplied.
- `SchemeName` is not derived from a client mapping. If absent, the app shows the scheme code and `-` rather than guessing.

## Local storage

SQLite database `pygma.db` contains:

| Table | Purpose |
|---|---|
| `user` | Agent, bank, theme, print config and collection status |
| `accounts` | Downloaded snapshot and local collection counters |
| `transactions` | Receipts and serialized synchronization state |
| `validations` | Limits, sequence values, dates, and time flag |
| `api_queue` | Pending API requests and retry metadata |

Rows also retain the complete API object in a JSON `data` column so fields not represented by dedicated columns are preserved.

Important AsyncStorage keys:

- `loginKey`, `agentId`, `bankId`: session credentials;
- `userPhone`: authenticated phone;
- `lastOtpId`: OTP request fallback;
- `deviceId`: registered device;
- `appConfig`: cached configuration;
- `accountDownloadTimeFlag`: exact downloaded-list version;
- `receiptPrinterAddress`: last successful Android printer.

## Permissions and platform differences

### Android

Manifest permissions include Internet, Contacts, fine/coarse Location, legacy Bluetooth through Android 11, and Bluetooth Connect/Scan on Android 12+.

- On the Mobile Number screen, the app first explains and then requests Phone,
  fine/coarse Location, and (on Android 13+) Notifications, matching the legacy
  Android registration flow.
- Contacts permission is requested when selecting a contact.
- Location is checked again during verification/collection when required.
- Bluetooth is requested only after Print is tapped.
- Android 12+ requests Nearby Devices.
- Android 11 and earlier request location for Bluetooth discovery.

### iOS

When the Mobile Number screen opens, iOS explains and requests Location and
Notification permissions. iOS has no Android-equivalent Phone State runtime
permission. `Info.plist` contains Bluetooth, contacts, and location usage
descriptions, including:

```xml
<key>NSContactsUsageDescription</key>
<string>Pygma needs contacts access to select an account phone number.</string>
```

iOS receipts currently use the system print sheet. Printers must be available through an iOS-supported mechanism, normally AirPrint or a vendor integration. Android Bluetooth Classic sockets are not used by the current iOS receipt path.

## Install and validate

From a clean checkout:

```bash
git clone <repository-url>
cd Pygma
npm ci
npm run lint
npm test -- --runInBand
```

Start Metro in its own terminal:

```bash
npm start
```

For stale Metro data:

```bash
npm start -- --reset-cache
```

## Android setup and execution

1. Install Android Studio, Platform 35, Build Tools 35.0.0, Platform Tools, and an emulator image.
2. Configure `ANDROID_HOME` and add `platform-tools` to `PATH`.
3. Confirm tooling:

```bash
java -version
adb version
```

4. Start an emulator or connect a device with USB debugging.
5. Confirm it is visible:

```bash
adb devices
```

6. With Metro running, install the debug build:

```bash
npm run android
```

Alternatively, open `android` in Android Studio and run the `app` configuration.

Android end-to-end steps:

1. Enter an agent phone and verify OTP.
2. Download accounts.
3. Start collection.
4. Choose an account, enter an amount, and collect.
5. Verify the transaction uploads or remains pending when offline.
6. Tap Print, grant permission, enable Bluetooth, and select a printer if no saved/connected printer exists.
7. Return to Dashboard and check counters.
8. Restore connectivity and verify pending reaches zero.
9. Submit the collection.

## iOS setup and execution

Install Pods using Bundler when possible:

```bash
bundle install
cd ios
bundle exec pod install
cd ..
```

Without Bundler:

```bash
cd ios
pod install
cd ..
```

Always open `ios/Pygma.xcworkspace`, not `.xcodeproj`.

Signing setup:

1. Open the workspace and select the Pygma target.
2. Choose the correct Development Team.
3. Set a bundle identifier owned by that team. The physical-device override currently references `com.inbi.pygma1`; confirm ownership.
4. Confirm version/build number and required privacy descriptions.

Run a simulator with Metro running:

```bash
npm run ios
```

Or select one explicitly:

```bash
npx react-native run-ios --simulator="iPhone 15"
```

For a physical device, select it in Xcode and run the Pygma scheme. Follow the same login/download/start/collect/sync/submit flow. Print opens the native iOS print sheet.

## Bluetooth and printing

Android pocket-printer flow:

```text
Tap Print
  -> ask Bluetooth permission
  -> ask to enable Bluetooth if disabled
  -> find remembered/currently connected printer
       -> found: connect/reuse and print directly
       -> absent/reconnect failed: open discovery sheet
  -> show bonded, connected and discovered devices
  -> select device and connect/pair
  -> send ESC/POS receipt
  -> remember successful printer address
```

The Android printer must support Bluetooth Classic serial communication and the ESC/POS text/commands generated by `ReceiptService.js`. Formatting currently targets 32 columns.

On iOS, `ReceiptService` generates HTML and calls `RNPrint.print`, which opens the system print UI. Direct raw Bluetooth Classic printing is not implemented on iOS.

Printer test cases:

- exact production printer model and paper width;
- permission denied/allowed;
- Bluetooth off/on;
- printer off and reconnect;
- first-time discovery and remembered direct print;
- headers/footers returned by the API;
- local/accented characters supported by the printer code page.

## Release builds

### Android

Create the configured release APK:

```bash
npm run build:android
```

Expected output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Important: `release` currently uses `debug.keystore` and is not production-ready. Before release:

1. Create/protect a production upload keystore outside source control.
2. Supply credentials using secure Gradle properties or CI secrets.
3. Configure the release signing config.
4. Increment `versionCode` and `versionName`.
5. Keep API `AppVersionId` aligned with the backend requirement.
6. Build a Play Store bundle:

```bash
cd android
./gradlew bundleRelease
```

### iOS

The script builds Release configuration:

```bash
npm run build:ios
```

For App Store/TestFlight distribution:

1. Open the workspace.
2. Select a generic iOS device.
3. Confirm team, bundle identifier, version, build, entitlements, and privacy descriptions.
4. Choose Product > Archive.
5. Validate and distribute the archive through App Store Connect.

## Testing checklist

Authentication:

- valid/invalid phone, OTP request/resend/expiry, correct/incorrect OTP;
- offline/server error messages;
- HTTP 401 cleanup and login reset.

Dashboard:

- empty state, account download/count, exact start time flag;
- restore Live collection after restart;
- confirmed, unconfirmed, local, synced, and pending totals;
- logout blocked while Live.

Collection:

- account fields match API values;
- empty, zero, negative, malformed, over-limit, and valid amounts;
- date window and maximum receipt rules;
- Previous, Next, Search and filters;
- contacts/phone update and directions;
- receipt list, Print, WhatsApp/share and Collect Again.

Offline and sync:

- collect offline and retain after restart;
- pending count equals unsynchronized transactions;
- reconnect automatically retries;
- failed uploads remain queued;
- retries do not duplicate pending counts;
- Submit remains blocked until pending is zero;
- successful Submit shows server values and clears the completed cycle.

## Troubleshooting

Metro/module failure:

```bash
npm ci
npm start -- --reset-cache
```

Android build cache:

```bash
cd android
./gradlew clean
cd ..
npm run android
```

Verify Java 17 and SDK 35.

iOS Pods/native modules:

```bash
cd ios
bundle exec pod install --repo-update
cd ..
```

Then clean the Xcode build folder and rebuild the workspace.

Android printer not listed:

- enable Bluetooth and grant Nearby Devices/location;
- power on and make the printer discoverable;
- pair it in Android Settings if required;
- confirm it supports Bluetooth Classic, not BLE-only.

Connected printer does not print:

- re-pair and retry selection;
- verify ESC/POS compatibility and paper width;
- ensure another app is not holding the connection;
- inspect Metro/Logcat connection/write errors.

iOS printer absent:

- the current path is the system print sheet, not Android Bluetooth discovery;
- use AirPrint-compatible hardware or integrate the manufacturer's iOS SDK/External Accessory protocol.

Missing account values:

- inspect `Agent/getaccounts` for `OpeningDate`, `LastTranDate`, `BalanceAmount`, `SchemeCode`, and `SchemeName`;
- download accounts again; the client intentionally does not manufacture missing business data.

Pending count not updating:

- confirm internet reachability and foreground/reopen Dashboard;
- inspect transaction `syncStatus`, pending `api_queue`, and the backend message from `Agent/updatetransaction`;
- never delete a transaction merely to bypass failed synchronization.

## Maintenance

- Update this guide when API URL/version, schemas, permissions, printing, signing, or collection-state rules change.
- Test database migrations and offline recovery before schema releases.
- Keep Android and iOS behavior aligned with the server contract while documenting unavoidable platform differences.
