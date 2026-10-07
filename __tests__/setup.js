jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-push-notification', () => ({
  configure: jest.fn(), createChannel: jest.fn(), localNotification: jest.fn(),
  localNotificationSchedule: jest.fn(), cancelLocalNotification: jest.fn(), cancelAllLocalNotifications: jest.fn(),
}));
jest.mock('@react-native-community/geolocation', () => ({ getCurrentPosition: jest.fn(), requestAuthorization: jest.fn(),
  setRNConfiguration: jest.fn(), watchPosition: jest.fn(() => 1), clearWatch: jest.fn() }));
jest.mock('react-native-background-actions', () => ({ start: jest.fn(), stop: jest.fn(), isRunning: jest.fn(() => false) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
Object.defineProperty(require('react-native').Platform, 'OS', { value: 'android', configurable: true });
