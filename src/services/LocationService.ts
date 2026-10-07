import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import PushNotification from 'react-native-push-notification';
import { Task } from '../store/types';
import { fetchJSON } from './http';
import { isYandexMapsConfigured, YANDEX_MAPS_CONFIG } from '../config/aiConfig';

// ─── Типы ─────────────────────────────────────────────────────────────────
export interface LocationInfo {
  lat: number;
  lon: number;
  placeName: string;         // "Пятёрочка, улица Ленина"
  placeType: string;         // "supermarket", "pharmacy", "gym" ...
  displayName: string;       // полный адрес
}

// ─── Категории мест → ключевые слова задач ────────────────────────────────
const PLACE_TASK_KEYWORDS: Record<string, string[]> = {
  supermarket:   ['купить', 'магазин', 'продукт', 'молоко', 'хлеб', 'еда', 'продовольств'],
  convenience:   ['купить', 'магазин', 'продукт', 'молок', 'хлеб', 'яйц', 'яиц', 'сыр', 'масло', 'чай', 'кофе'],
  marketplace:   ['купить', 'рынок', 'продукт'],
  grocery:       ['купить', 'продукт', 'еда', 'молок', 'хлеб', 'яйц', 'яиц', 'сыр', 'масло', 'овощ', 'фрукт'],
  shop:          ['купить', 'магазин'],
  clothes: ['одежд', 'куртк', 'брюк', 'футболк', 'вещи'],
  shoes: ['обув', 'ботинк', 'кроссовк'],
  bakery: ['хлеб', 'булоч', 'выпечк'],
  butcher: ['мясо', 'фарш', 'колбас'],
  greengrocer: ['овощ', 'фрукт', 'картош', 'яблок'],
  hardware: ['инструмент', 'гвозд', 'шуруп', 'краск'],
  stationery: ['канцеляр', 'тетрад', 'ручк'],
  pet: ['корм', 'зоомагазин'],
  pharmacy:      ['аптека', 'лекарств', 'таблетк', 'витамин', 'препарат'],
  gym:           ['спорт', 'тренировк', 'зал', 'фитнес', 'качалк'],
  fitness_centre:['спорт', 'тренировк', 'зал', 'фитнес'],
  school:        ['учёба', 'урок', 'лекция', 'школ'],
  university:    ['универ', 'лекция', 'пары', 'учёба', 'сессия'],
  college:       ['колледж', 'учёба', 'пары'],
  bank:          ['банк', 'деньги', 'кредит', 'вклад', 'снять наличные'],
  atm:           ['банкомат', 'наличные', 'снять деньги'],
  hospital:      ['врач', 'больниц', 'клиник', 'доктор', 'поликлиник'],
  doctors:       ['врач', 'доктор', 'приём'],
  cafe:          ['кофе', 'обед', 'завтрак', 'встреч', 'кафе'],
  restaurant:    ['обед', 'ужин', 'ресторан', 'встреч'],
  post_office:   ['почта', 'посылк', 'письмо', 'отправить'],
  fuel:          ['заправка', 'бензин', 'авто'],
  car_wash:      ['автомойка', 'помыть машину'],
  dentist:       ['стоматолог', 'зуб', 'дантист'],
  hairdresser:   ['парикмахер', 'стрижка', 'волосы'],
  laundry:       ['прачечная', 'постирать', 'химчистка'],
};

const LOCATION_CHANNEL_ID = 'virtus-location-channel';

// ─── Создание канала уведомлений ─────────────────────────────────────────
export function createLocationNotificationChannel() {
  PushNotification.createChannel(
    {
      channelId: LOCATION_CHANNEL_ID,
      channelName: 'Умные напоминания (геолокация)',
      channelDescription: 'Уведомления на основе вашего местоположения',
      importance: 4,
      vibrate: true,
      playSound: true,
    },
    () => {},
  );
}

// ─── Запрос разрешения на геолокацию ────────────────────────────────────
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return new Promise(resolve => Geolocation.requestAuthorization(() => resolve(true), () => resolve(false)));
  }
  if (Platform.OS !== 'android') return false;

  try {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    if (await PermissionsAndroid.check(fine) || await PermissionsAndroid.check(coarse)) return true;
    const granted = await PermissionsAndroid.requestMultiple([fine, coarse]);
    return granted[fine] === PermissionsAndroid.RESULTS.GRANTED ||
      granted[coarse] === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// ─── Получение текущих координат ─────────────────────────────────────────
export async function getCurrentCoordinates(background = false): Promise<{ lat: number; lon: number }> {
  const permitted = background && Platform.OS === 'android'
    ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) ||
      await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION)
    : await requestLocationPermission();
  if (!permitted) throw new Error('Нет доступа к геолокации. Разрешите доступ к местоположению в настройках приложения.');
  return new Promise((resolve, reject) => {
    const accept = (pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => {
      if (background && pos.coords.accuracy > 200) {
        reject(new Error('Для напоминаний рядом с магазином включите точное местоположение.'));
        return;
      }
      resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    };
    const fail = (err: { code: number; message: string }) => reject(new Error(err.code === 3
      ? 'Не удалось получить координаты. Включите геолокацию на телефоне и попробуйте ещё раз.'
      : `Геолокация недоступна: ${err.message}`));
    Geolocation.getCurrentPosition(accept, err => {
      // Indoors GPS may time out. A recent network fix is also suitable if its accuracy is sufficient.
      if (background && err.code === 3) {
        Geolocation.getCurrentPosition(accept, fail, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 });
      } else fail(err);
    }, { enableHighAccuracy: background, timeout: 20000, maximumAge: background ? 10000 : 60000 });
  });
}

// ─── Reverse geocoding через Nominatim (OpenStreetMap, бесплатно) ─────────
export async function reverseGeocode(lat: number, lon: number): Promise<LocationInfo> {
  if (isYandexMapsConfigured()) {
    try {
      const data = await fetchJSON(`https://geocode-maps.yandex.ru/1.x/?format=json&lang=ru_RU&apikey=${encodeURIComponent(YANDEX_MAPS_CONFIG.GEOCODER_API_KEY)}&geocode=${lon},${lat}`);
      const place = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
      if (place) return { lat, lon, placeName: place.name,
        placeType: place.metaDataProperty?.GeocoderMetaData?.kind || 'unknown',
        displayName: place.metaDataProperty?.GeocoderMetaData?.Address?.formatted || place.description || place.name };
    } catch { /* Try OpenStreetMap when Yandex is unavailable. */ }
  }
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

  const data = await fetchJSON(url, {
    headers: { 'User-Agent': 'VirtusPlanner/1.0 (mobile app)' },
  });

  if (data.error) throw new Error('Не удалось определить адрес по координатам.');

  // Определяем тип места из тегов Nominatim
  const type: string =
    data?.type ||
    data?.addresstype ||
    data?.address?.amenity?.toLowerCase().replace(/ /g, '_') ||
    'unknown';

  const placeName =
    data?.address?.shop ||
    data?.address?.amenity ||
    data?.address?.leisure ||
    data?.address?.road ||
    data?.display_name?.split(',')[0] ||
    'Неизвестное место';

  return {
    lat,
    lon,
    placeType: type,
    placeName,
    displayName: data?.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
  };
}

// ─── Поиск подходящих задач по типу места ────────────────────────────────
export function findMatchingTasks(location: LocationInfo, tasks: Task[]): Task[] {
  const keywords = PLACE_TASK_KEYWORDS[location.placeType] || [];


  // Сегодняшняя дата
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return tasks.filter(t => {
    if (t.completed) return false;
    if (t.date !== todayStr) return false;
    const titleLower = t.title.toLowerCase().replace(/ё/g, 'е');
    const namedChains = ['пятерочк', 'магнит', 'перекресток', 'ашан', 'лента', 'вкусвилл', 'дикси', 'озон', 'ozon', 'wildberries', 'валберис'];
    const requestedChain = namedChains.find(name => titleLower.includes(name));
    const placeLower = location.placeName.toLowerCase().replace(/ё/g, 'е');
    if (requestedChain && !placeLower.includes(requestedChain)) return false;
    const namedVisit = Boolean(requestedChain) || (/сход|зайт|забрат|куп|магазин|посет/.test(titleLower) &&
      placeLower.length >= 4 && titleLower.includes(placeLower));
    // Specific purchases must not match an unrelated shop just because they say "купить".
    if (/продукт|молок|хлеб|яиц|яйц|овощ|фрукт|еда|питани/.test(titleLower) &&
      !['supermarket', 'convenience', 'marketplace', 'grocery', 'bakery', 'butcher', 'greengrocer'].includes(location.placeType)) return false;
    if (/аптек|лекарств|таблетк|препарат/.test(titleLower) && location.placeType !== 'pharmacy') return false;
    if (/одежд|обув|куртк|брюк/.test(titleLower) &&
      ['supermarket', 'convenience', 'marketplace', 'grocery'].includes(location.placeType)) return false;
    return Boolean(namedVisit) || keywords.some(kw => titleLower.includes(kw.replace(/ё/g, 'е')));
  });
}

// ─── Отправка push-уведомления о локации ─────────────────────────────────
export function showLocationNotification(tasks: Task[], placeName: string) {
  if (tasks.length === 0) return;

  const taskList = tasks.map(t => `"${t.title}"`).join(', ');
  const title = tasks.length === 1
    ? `📍 Вы рядом — не забудьте!`
    : `📍 Вы рядом — ${tasks.length} задачи рядом!`;

  const message = tasks.length === 1
    ? `${placeName}: у вас есть задача ${taskList}`
    : `Рядом с ${placeName} у вас задачи: ${taskList}`;

  PushNotification.localNotification({
    channelId: LOCATION_CHANNEL_ID,
    id: '730001',
    title,
    message,
    importance: 'high',
    priority: 'high',
    vibrate: true,
    playSound: true,
  });
}

// Reuse a larger map area while walking; measure every distance from the latest GPS fix.
let reminderCache: { lat: number; lon: number; at: number; places: NearbyPlace[] } | null = null;
export function clearReminderPlaceCache() { reminderCache = null; }
async function nearbyReminderPlaces(lat: number, lon: number): Promise<NearbyPlace[]> {
  if (!reminderCache || Date.now() - reminderCache.at > 5 * 60 * 1000 ||
      distanceMeters(lat, lon, reminderCache.lat, reminderCache.lon) > 200) {
    const places = await searchNearbyPlaces(lat, lon, 'all', 600);
    reminderCache = { lat, lon, at: Date.now(), places };
  }
  return reminderCache.places.map(p => ({ ...p, distance: distanceMeters(lat, lon, p.lat, p.lon) }))
    .filter(p => p.distance <= 300).sort((a, b) => a.distance - b.distance);
}

// ─── Полная проверка локации (координаты → поиск задач → уведомление) ────
export async function checkLocationAndNotify(tasks: Task[], notify = true): Promise<{
  location: LocationInfo;
  matchedTasks: Task[];
  message: string;
}> {
  const coords = await getCurrentCoordinates(!notify);
  const places = notify
    ? await searchNearbyPlaces(coords.lat, coords.lon, 'all', 300)
    : await nearbyReminderPlaces(coords.lat, coords.lon);
  const matchingPlace = places.find(place => findMatchingTasks(place, tasks).length > 0);
  const location = matchingPlace || {
    ...coords, placeName: 'Текущее местоположение', placeType: 'unknown',
    displayName: `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`,
  };
  const matchedTasks = matchingPlace ? findMatchingTasks(matchingPlace, tasks) : [];

  if (notify && matchedTasks.length > 0) {
    showLocationNotification(matchedTasks, location.placeName);
  }

  // Формируем текст для чата
  let message = `📍 Вы сейчас здесь: **${location.placeName}**\n${location.displayName.split(',').slice(0, 3).join(',')}\n\n`;

  if (matchedTasks.length > 0) {
    message += `🎯 Отлично! Рядом можно выполнить:\n`;
    matchedTasks.forEach(t => {
      message += `• ${t.time} — ${t.title} (${t.category})\n`;
    });
    if (notify) message += `\nОтправил напоминание! 🔔`;
  } else {
    message += `На сегодня нет задач, связанных с этим местом.\n`;
    message += `Все актуальные задачи уже выполнены или запланированы в другом месте.`;
  }

  return { location, matchedTasks, message };
}

export type NearbyKind = 'shops' | 'pharmacy' | 'cafe' | 'gym' | 'bank' | 'all';
export interface NearbyPlace extends LocationInfo { distance: number }

const NEARBY_FILTERS: Record<NearbyKind, string[]> = {
  shops: ['["shop"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
  cafe: ['["amenity"~"^(cafe|restaurant|fast_food)$"]'],
  gym: ['["leisure"="fitness_centre"]'],
  bank: ['["amenity"~"^(bank|atm)$"]'],
  all: ['["shop"]', '["amenity"~"^(pharmacy|cafe|restaurant|bank|atm|hospital|doctors|dentist|post_office|fuel|school|university|college)$"]', '["leisure"="fitness_centre"]'],
};

export function getLocationIntent(text: string): NearbyKind | 'location' | null {
  const lower = text.toLowerCase().replace(/ё/g, 'е');
  // Commands that change tasks must still go to the task handler.
  if (/^(добав|созда|запланиру|удал|измен|перенес|отмет)/.test(lower)) return null;
  if (/где я|мое местополож|геолокац|проверь.*локац/.test(lower)) return 'location';
  if (!/рядом|поблизости|по близости|ближайш|недалеко|около меня/.test(lower)) return null;
  if (/аптек|лекарств/.test(lower)) return 'pharmacy';
  if (/кафе|кофе|ресторан|поесть/.test(lower)) return 'cafe';
  if (/зал|фитнес|спорт/.test(lower)) return 'gym';
  if (/банк|банкомат/.test(lower)) return 'bank';
  if (/магазин|продукт|купить|супермаркет/.test(lower)) return 'shops';
  return 'all';
}

export function distanceMeters(lat: number, lon: number, otherLat: number, otherLon: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(otherLat - lat) / 2) ** 2 +
    Math.cos(radians(lat)) * Math.cos(radians(otherLat)) * Math.sin(radians(otherLon - lon) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export async function searchNearbyPlaces(lat: number, lon: number, kind: NearbyKind, radius = 1500): Promise<NearbyPlace[]> {
  const query = `[out:json][timeout:20];(${NEARBY_FILTERS[kind].map(filter =>
    `nwr${filter}(around:${radius},${lat},${lon});`).join('')});out center tags;`;
  let data: any;
  let lastError: unknown;
  for (const endpoint of ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter']) {
    try {
      data = await fetchJSON(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json', 'User-Agent': 'VirtusPlanner/1.0 (React Native personal task planner)' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!Array.isArray(data.elements) || data.remark) throw new Error('Поиск мест временно недоступен. Попробуйте позже.');
      break;
    } catch (error) { lastError = error; data = undefined; }
  }
  if (!data) throw lastError;
  if (!Array.isArray(data.elements) || data.remark) throw new Error('Поиск мест временно недоступен. Попробуйте позже.');
  const names: Record<string, string> = { supermarket: 'Супермаркет', convenience: 'Продуктовый магазин',
    pharmacy: 'Аптека', cafe: 'Кафе', restaurant: 'Ресторан', fitness_centre: 'Спортивный зал', atm: 'Банкомат', bank: 'Банк' };
  const places: NearbyPlace[] = [];
  for (const element of data.elements) {
    const placeLat = element.lat ?? element.center?.lat;
    const placeLon = element.lon ?? element.center?.lon;
    if (!Number.isFinite(placeLat) || !Number.isFinite(placeLon)) continue;
    const tags = element.tags || {};
    const type = tags.shop || tags.amenity || tags.leisure || 'unknown';
    const distance = distanceMeters(lat, lon, placeLat, placeLon);
    if (distance > radius) continue;
    const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ');
    const placeName = tags.name || tags.brand || names[type] || 'Магазин';
    if (places.some(p => p.placeName === placeName && distanceMeters(p.lat, p.lon, placeLat, placeLon) < 40)) continue;
    places.push({ lat: placeLat, lon: placeLon, placeName, placeType: type,
      displayName: address || `Координаты: ${placeLat.toFixed(5)}, ${placeLon.toFixed(5)}`, distance });
  }
  return places.sort((a, b) => a.distance - b.distance);
}

export async function answerLocationQuery(intent: NearbyKind | 'location'): Promise<string> {
  const { lat, lon } = await getCurrentCoordinates();
  if (intent === 'location') {
    const location = await reverseGeocode(lat, lon);
    return `📍 Вы сейчас здесь: ${location.placeName}\n${location.displayName}`;
  }
  const places = await searchNearbyPlaces(lat, lon, intent);
  if (!places.length) return '📍 В радиусе 1,5 км подходящих мест в OpenStreetMap не найдено. Данные карты могут быть неполными.';
  return `📍 Места поблизости (до 1,5 км):\n\n${places.slice(0, 5).map((p, i) =>
    `${i + 1}. ${p.placeName} — ${Math.round(p.distance)} м\n${p.displayName}`).join('\n\n')}\n\nРасстояние указано по прямой. Данные: OpenStreetMap.`;
}

// ─── Описание места для системного промпта AI ─────────────────────────────
export function getLocationContextString(location: LocationInfo): string {
  return `${location.placeName} (${location.placeType}), адрес: ${location.displayName.split(',').slice(0, 3).join(',')}`;
}
