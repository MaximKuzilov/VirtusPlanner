import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import BackgroundService from 'react-native-background-actions';
import PushNotification from 'react-native-push-notification';
import { startBackgroundLocationService, stopBackgroundLocationService, isBackgroundServiceRunning } from '../src/services/BackgroundLocationService';
import { requestLocationPermission, setIOSBackgroundLocationEnabled, checkLocationAndNotify } from '../src/services/LocationService';
import { scheduleBackgroundTimerUpdates, showOngoingTimerNotification, scheduleTimerNotification, configureNotifications } from '../src/services/NotificationService';

jest.mock('../src/services/LocationService', () => ({
  ...jest.requireActual('../src/services/LocationService'), checkLocationAndNotify: jest.fn(),
}));

beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  await stopBackgroundLocationService();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (Geolocation.requestAuthorization as jest.Mock).mockImplementation(success => success());
});
afterEach(async () => {
  await stopBackgroundLocationService();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
});

test('foreground lookup requests only when-in-use access', async () => {
  setIOSBackgroundLocationEnabled(false);
  expect(await requestLocationPermission()).toBe(true);
  expect(Geolocation.setRNConfiguration).toHaveBeenLastCalledWith(expect.objectContaining({
    authorizationLevel: 'whenInUse', enableBackgroundLocationUpdates: false,
  }));
});

test('denied access does not start native updates', async () => {
  (Geolocation.requestAuthorization as jest.Mock).mockImplementation((_success, fail) => fail());
  await startBackgroundLocationService();
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
  expect(isBackgroundServiceRunning()).toBe(false);
});

test('iOS uses one location watcher, clears it on stop, and never starts Android service', async () => {
  await Promise.all([startBackgroundLocationService(), startBackgroundLocationService()]);
  await startBackgroundLocationService();
  expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
  expect(BackgroundService.start).not.toHaveBeenCalled();
  expect(isBackgroundServiceRunning()).toBe(true);
  await stopBackgroundLocationService();
  expect(Geolocation.clearWatch).toHaveBeenCalledWith(1);
  expect(isBackgroundServiceRunning()).toBe(false);
});

test('stop during pending permission cannot leave a watcher running', async () => {
  let authorize: (() => void) | undefined;
  (Geolocation.requestAuthorization as jest.Mock).mockImplementation(success => { authorize = success; });
  const start = startBackgroundLocationService();
  await new Promise<void>(resolve => setImmediate(resolve));
  await stopBackgroundLocationService();
  authorize!();
  await start;
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
});

test('disabled reminders never request background location access', async () => {
  await AsyncStorage.setItem('@virtus_settings', JSON.stringify({ notifications: false }));
  await startBackgroundLocationService();
  expect(Geolocation.requestAuthorization).not.toHaveBeenCalled();
  expect(Geolocation.watchPosition).not.toHaveBeenCalled();
});

test('movement updates reuse their coordinates, ignore poor accuracy and throttle map checks', async () => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const tasks = [{ id: 'ios-task', title: 'Купить молоко', date, completed: false }];
  await AsyncStorage.setItem('@virtus_tasks', JSON.stringify(tasks));
  await AsyncStorage.setItem('@virtus_settings', JSON.stringify({ notifications: true, quietHoursStart: '00:00', quietHoursEnd: '00:00' }));
  (checkLocationAndNotify as jest.Mock).mockResolvedValue({ matchedTasks: [] });
  await startBackgroundLocationService();
  const update = (Geolocation.watchPosition as jest.Mock).mock.calls[0][0];
  update({ coords: { latitude: 59, longitude: 39, accuracy: 500 } });
  expect(checkLocationAndNotify).not.toHaveBeenCalled();
  update({ coords: { latitude: 59, longitude: 39, accuracy: 20 } });
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(checkLocationAndNotify).toHaveBeenCalledWith(tasks, false, { lat: 59, lon: 39 });
  update({ coords: { latitude: 59, longitude: 39, accuracy: 20 } });
  expect(checkLocationAndNotify).toHaveBeenCalledTimes(1);
});

test('iOS schedules timer completion without countdown notification spam or APNs registration', () => {
  configureNotifications();
  expect(PushNotification.configure).toHaveBeenCalledWith(expect.objectContaining({ requestPermissions: false }));
  showOngoingTimerNotification('Focus', 60);
  scheduleBackgroundTimerUpdates('Focus', Date.now(), 60);
  expect(PushNotification.localNotification).not.toHaveBeenCalled();
  expect(PushNotification.localNotificationSchedule).not.toHaveBeenCalled();
  scheduleTimerNotification('Focus', 60000);
  expect(PushNotification.localNotificationSchedule).toHaveBeenCalledTimes(1);
});
