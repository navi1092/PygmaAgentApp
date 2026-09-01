#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridgeModule.h>
#import <Contacts/Contacts.h>
#import <ContactsUI/ContactsUI.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import <UserNotifications/UserNotifications.h>

@interface PygmaNotificationPermission : NSObject <RCTBridgeModule>
@end

@implementation PygmaNotificationPermission

RCT_EXPORT_MODULE(PygmaNotificationPermission);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(requestPermission,
                 requestPermissionWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNAuthorizationOptions options = UNAuthorizationOptionAlert |
                                   UNAuthorizationOptionSound |
                                   UNAuthorizationOptionBadge;
  [[UNUserNotificationCenter currentNotificationCenter]
      requestAuthorizationWithOptions:options
      completionHandler:^(BOOL granted, NSError *error) {
        if (error != nil) {
          reject(@"E_NOTIFICATION_PERMISSION", error.localizedDescription, error);
          return;
        }
        resolve(@(granted));
      }];
}

@end

@interface PygmaContactPicker : NSObject <RCTBridgeModule, CNContactPickerDelegate>
@property(nonatomic, copy) RCTPromiseResolveBlock resolve;
@property(nonatomic, copy) RCTPromiseRejectBlock reject;
@end

@implementation PygmaContactPicker

RCT_EXPORT_MODULE(PygmaContactPicker);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_REMAP_METHOD(selectPhone,
                 selectPhoneWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.resolve != nil) {
      reject(@"E_CONTACT_PICKER_OPEN", @"The contact picker is already open.", nil);
      return;
    }

    self.resolve = resolve;
    self.reject = reject;

    CNContactPickerViewController *picker = [CNContactPickerViewController new];
    picker.delegate = self;
    picker.displayedPropertyKeys = @[CNContactPhoneNumbersKey];
    picker.predicateForEnablingContact = [NSPredicate predicateWithFormat:@"phoneNumbers.@count > 0"];
    // A contact can have several numbers. Let iOS show its own number selector
    // and return only the number the user explicitly picks.
    picker.predicateForSelectionOfContact = [NSPredicate predicateWithValue:NO];
    picker.predicateForSelectionOfProperty = [NSPredicate predicateWithFormat:@"key == %@", CNContactPhoneNumbersKey];

    UIViewController *controller = UIApplication.sharedApplication.delegate.window.rootViewController;
    while (controller.presentedViewController != nil) {
      controller = controller.presentedViewController;
    }
    [controller presentViewController:picker animated:YES completion:nil];
  });
}

- (void)contactPicker:(CNContactPickerViewController *)picker didSelectContactProperty:(CNContactProperty *)contactProperty
{
  CNPhoneNumber *phoneNumber = [contactProperty.value isKindOfClass:CNPhoneNumber.class] ? contactProperty.value : nil;
  [self completeWithNumber:phoneNumber.stringValue];
}

- (void)contactPickerDidCancel:(CNContactPickerViewController *)picker
{
  [self completeWithNumber:nil];
}

- (void)completeWithNumber:(NSString *)number
{
  RCTPromiseResolveBlock resolve = self.resolve;
  self.resolve = nil;
  self.reject = nil;
  if (resolve != nil) {
    resolve(number ?: (id)kCFNull);
  }
}

@end

// The Bluetooth permission dialog is only shown after an app uses a Core
// Bluetooth API. AirPrint does not initialize Core Bluetooth by itself, so
// keep this small bridge separate from the print UI and invoke it on Print.
@interface PygmaBluetoothPermission : NSObject <RCTBridgeModule, CBCentralManagerDelegate>
@property(nonatomic, strong) CBCentralManager *centralManager;
@property(nonatomic, copy) RCTPromiseResolveBlock resolve;
@property(nonatomic, copy) RCTPromiseRejectBlock reject;
@end

@implementation PygmaBluetoothPermission

RCT_EXPORT_MODULE(PygmaBluetoothPermission);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_REMAP_METHOD(requestPermission,
                 requestPermissionWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.resolve != nil) {
      reject(@"E_BLUETOOTH_PERMISSION_IN_PROGRESS", @"A Bluetooth permission request is already in progress.", nil);
      return;
    }

    self.resolve = resolve;
    self.reject = reject;
    // Creating the manager triggers iOS's standard Bluetooth permission
    // prompt on its first use. The wording is provided by Info.plist.
    self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:nil];
  });
}

- (void)centralManagerDidUpdateState:(CBCentralManager *)central
{
  if (self.resolve == nil) return;

  BOOL permitted = central.state != CBManagerStateUnauthorized && central.state != CBManagerStateUnsupported;
  RCTPromiseResolveBlock resolve = self.resolve;
  self.resolve = nil;
  self.reject = nil;
  self.centralManager = nil;
  resolve(@(permitted));
}

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"Pygma";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
