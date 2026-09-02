#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridgeModule.h>
#import <Contacts/Contacts.h>
#import <ContactsUI/ContactsUI.h>

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
