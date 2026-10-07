#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <RNCPushNotificationIOS.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"VirtusPlanner";
  self.initialProps = @{};
  [UNUserNotificationCenter currentNotificationCenter].delegate = self;
  // Local notifications only: no APNs entitlement or server is needed.
  [[UNUserNotificationCenter currentNotificationCenter]
    requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionBadge | UNAuthorizationOptionSound)
    completionHandler:^(BOOL granted, NSError *error) {}];
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
  didReceiveNotificationResponse:(UNNotificationResponse *)response
  withCompletionHandler:(void (^)(void))completionHandler
{
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
  completionHandler();
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
  willPresentNotification:(UNNotification *)notification
  withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler
{
  completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionList | UNNotificationPresentationOptionSound);
}
@end
