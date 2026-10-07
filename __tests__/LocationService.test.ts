import * as aiConfig from '../src/config/aiConfig';
import { PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { clearReminderPlaceCache, answerLocationQuery, getLocationIntent, searchNearbyPlaces, findMatchingTasks, distanceMeters, checkLocationAndNotify, reverseGeocode } from '../src/services/LocationService';
import PushNotification from 'react-native-push-notification';
import { Task } from '../src/store/types';

beforeEach(() => {
  jest.clearAllMocks();
  clearReminderPlaceCache();
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success => success({ coords: { latitude: 59.22, longitude: 39.88 } }));
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [
    { lat: 59.221, lon: 39.88, tags: { name: 'Магазин рядом', shop: 'supermarket', 'addr:street': 'Ленина', 'addr:housenumber': '1' } },
    { center: { lat: 59.222, lon: 39.88 }, tags: { name: 'Другой магазин', shop: 'convenience' } },
    { lat: 60, lon: 39.88, tags: { name: 'Далеко', shop: 'supermarket' } },
  ] }) });
});

test.each([
  ['магазины по близости', 'shops'], ['Покажи магазины поблизости', 'shops'],
  ['Где ближайшая аптека?', 'pharmacy'], ['Кафе рядом', 'cafe'], ['Где я?', 'location'],
  ['Добавь задачу купить молоко в магазине рядом', null], ['Мои задачи', null],
])('intent %s', (query, intent) => expect(getLocationIntent(query)).toBe(intent));

test('nearby query returns actual names, address and distance', async () => {
  const reply = await answerLocationQuery('shops');
  expect(reply).toContain('Магазин рядом — 111 м');
  expect(reply).toContain('Ленина, 1');
  expect(reply).not.toContain('Далеко');
  expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('overpass'), expect.objectContaining({ method: 'POST' }));
});
test('denied permission does not contact maps', async () => {
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({} as any);
  await expect(answerLocationQuery('shops')).rejects.toThrow('Нет доступа');
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
test('approximate location permission is accepted', async () => {
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({ [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: 'granted' } as any);
  await expect(answerLocationQuery('shops')).resolves.toContain('Магазин рядом');
});
test('empty results are explained', async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ elements: [] }) });
  await expect(answerLocationQuery('shops')).resolves.toContain('не найдено');
});
test('map HTTP errors are not reported as empty results', async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
  await expect(answerLocationQuery('shops')).rejects.toThrow('503');
});
test('incomplete Overpass response is rejected', async () => {
  (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ elements: [], remark: 'timeout' }) });
  await expect(searchNearbyPlaces(59.22, 39.88, 'shops')).rejects.toThrow('недоступен');
});
test('distance at identical coordinates is zero', () => expect(distanceMeters(59, 39, 59, 39)).toBe(0));
test('grocery and medicine reminders do not match unrelated shops', () => {
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const task = { title: 'Купить молоко', date: today, completed: false } as Task;
  const place = { lat: 59, lon: 39, placeType: 'shop', placeName: 'Магазин одежды', displayName: 'Адрес' };
  expect(findMatchingTasks(place, [task])).toEqual([]);
  expect(findMatchingTasks({ ...place, placeType: 'supermarket' }, [{ ...task, title: 'Купить лекарства' }])).toEqual([]);
});
test('configured Yandex geocoder returns the real address', async () => {
  const configured = jest.spyOn(aiConfig, 'isYandexMapsConfigured').mockReturnValue(true);
  (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ response: { GeoObjectCollection: { featureMember: [
    { GeoObject: { name: 'улица Ленина, 8', metaDataProperty: { GeocoderMetaData: { kind: 'house', Address: { formatted: 'Вологда, улица Ленина, 8' } } } } },
  ] } } }) });
  await expect(reverseGeocode(59, 39)).resolves.toMatchObject({ displayName: 'Вологда, улица Ленина, 8' });
  configured.mockRestore();
});
test('background inspection can suppress notification until cooldown is checked', async () => {
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const task = { id: '1', title: 'Купить молоко', date: today, completed: false } as Task;
  const result = await checkLocationAndNotify([task], false);
  expect(result.matchedTasks).toHaveLength(1);
  expect(PushNotification.localNotification).not.toHaveBeenCalled();
  expect(findMatchingTasks(result.location, [{ ...task, completed: true }])).toHaveLength(0);
});

const todayTask = (title: string) => ({ id: 'shop-task', title, date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(), completed: false } as Task);
test('a requested chain must match the store name', () => {
  const place = { lat: 59, lon: 39, placeType: 'supermarket', placeName: 'Пятёрочка', displayName: 'Адрес' };
  expect(findMatchingTasks(place, [todayTask('Сходить в Пятерочку за продуктами')])).toHaveLength(1);
  expect(findMatchingTasks({ ...place, placeName: 'Магнит' }, [todayTask('Купить молоко в Пятерочке')])).toHaveLength(0);
});
test('a shop reminder is only for unfinished tasks dated today', () => {
  const place = { lat: 59, lon: 39, placeType: 'convenience', placeName: 'Продукты', displayName: 'Адрес' };
  const task = todayTask('Сходить за молоком');
  expect(findMatchingTasks(place, [task])).toHaveLength(1);
  expect(findMatchingTasks(place, [{ ...task, completed: true }, { ...task, date: '2099-01-01' }])).toHaveLength(0);
});
test('cached maps use the latest coordinates and never alert outside 300m', async () => {
  const task = todayTask('Купить молоко');
  await expect(checkLocationAndNotify([task], false)).resolves.toMatchObject({ matchedTasks: [task] });
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success => success({ coords: { latitude: 59.2183, longitude: 39.88, accuracy: 10 } }));
  const result = await checkLocationAndNotify([task], false);
  expect(result.matchedTasks).toHaveLength(0);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
test('imprecise GPS does not trigger a false nearby reminder', async () => {
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success => success({ coords: { latitude: 59.22, longitude: 39.88, accuracy: 1000 } }));
  await expect(checkLocationAndNotify([todayTask('Купить молоко')], false)).rejects.toThrow('точное местоположение');
  expect(PushNotification.localNotification).not.toHaveBeenCalled();
});

test('indoor GPS timeout falls back to an accurate network position', async () => {
  (Geolocation.getCurrentPosition as jest.Mock)
    .mockImplementationOnce((_success, error) => error({ code: 3, message: 'timeout' }))
    .mockImplementationOnce(success => success({ coords: { latitude: 59.22, longitude: 39.88, accuracy: 30 } }));
  await expect(checkLocationAndNotify([todayTask('Сходить за продуктами')], false)).resolves.toMatchObject({ matchedTasks: [expect.objectContaining({ title: 'Сходить за продуктами' })] });
  expect(Geolocation.getCurrentPosition).toHaveBeenLastCalledWith(expect.any(Function), expect.any(Function), expect.objectContaining({ enableHighAccuracy: false }));
});

test('a pickup task named Ozon matches only that pickup point', () => {
  const place = { lat: 59, lon: 39, placeType: 'outpost', placeName: 'Ozon', displayName: 'Адрес' };
  expect(findMatchingTasks(place, [todayTask('Ozon')])).toHaveLength(1);
  expect(findMatchingTasks({ ...place, placeName: 'Wildberries' }, [todayTask('Ozon')])).toHaveLength(0);
});
