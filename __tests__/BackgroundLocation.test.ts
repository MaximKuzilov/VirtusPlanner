import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import { checkBackgroundLocationOnce } from '../src/services/BackgroundLocationService';
import { checkLocationAndNotify } from '../src/services/LocationService';
import { getDateStr } from '../src/store/AppContext';

jest.mock('../src/services/LocationService', () => ({
  ...jest.requireActual('../src/services/LocationService'), checkLocationAndNotify: jest.fn(),
}));
const task = { id: '1', title: 'Купить молоко', date: getDateStr(0), completed: false };
const result = { location: { lat: 59, lon: 39, placeType: 'supermarket', placeName: 'Магазин', displayName: 'Адрес' }, matchedTasks: [task] };
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('@virtus_settings', JSON.stringify({ notifications: true, quietHoursStart: '00:00', quietHoursEnd: '00:00' }));
  await AsyncStorage.setItem('@virtus_tasks', JSON.stringify([task]));
  (checkLocationAndNotify as jest.Mock).mockResolvedValue(result);
});
test('cooldown prevents a second notification', async () => {
  await checkBackgroundLocationOnce();
  await checkBackgroundLocationOnce();
  expect(PushNotification.localNotification).toHaveBeenCalledTimes(1);
  expect(checkLocationAndNotify).toHaveBeenCalledWith([task], false);
});
test('notifications disabled means no coordinates are requested', async () => {
  await AsyncStorage.setItem('@virtus_settings', JSON.stringify({ notifications: false }));
  await checkBackgroundLocationOnce();
  expect(checkLocationAndNotify).not.toHaveBeenCalled();
});
test('completed while maps are loading does not trigger a stale reminder', async () => {
  (checkLocationAndNotify as jest.Mock).mockImplementation(async () => {
    await AsyncStorage.setItem('@virtus_tasks', JSON.stringify([{ ...task, completed: true }]));
    return result;
  });
  await checkBackgroundLocationOnce();
  expect(PushNotification.localNotification).not.toHaveBeenCalled();
});

test('future tasks do not request background location', async () => {
  await AsyncStorage.setItem('@virtus_tasks', JSON.stringify([{ ...task, date: getDateStr(1) }]));
  await checkBackgroundLocationOnce();
  expect(checkLocationAndNotify).not.toHaveBeenCalled();
});
test('simultaneous checks cannot produce duplicate notifications', async () => {
  await Promise.all([checkBackgroundLocationOnce(), checkBackgroundLocationOnce()]);
  expect(PushNotification.localNotification).toHaveBeenCalledTimes(1);
});
test('a new shopping task is not blocked by another task cooldown', async () => {
  await checkBackgroundLocationOnce();
  const second = { ...task, id: '2', title: 'Купить хлеб' };
  await AsyncStorage.setItem('@virtus_tasks', JSON.stringify([task, second]));
  (checkLocationAndNotify as jest.Mock).mockResolvedValue({ ...result, matchedTasks: [task, second] });
  await checkBackgroundLocationOnce();
  expect(PushNotification.localNotification).toHaveBeenCalledTimes(2);
  expect(PushNotification.localNotification).toHaveBeenLastCalledWith(expect.objectContaining({ message: expect.stringContaining('Купить хлеб') }));
  expect((PushNotification.localNotification as jest.Mock).mock.calls[1][0].message).not.toContain('Купить молоко');
});
