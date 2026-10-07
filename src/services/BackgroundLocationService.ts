/**
 * BackgroundLocationService
 *
 * Запускает фоновый Android Foreground Service, который каждую минуту
 * проверяет геолокацию и отправляет уведомление, если пользователь
 * находится рядом с местом, связанным с задачей на сегодня.
 *
 * Работает даже когда приложение свёрнуто или экран выключен.
 */

import BackgroundService from 'react-native-background-actions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../store/types';
import { AppState, Platform } from 'react-native';
import { canNotify } from '../utils/notificationPolicy';
import {
  checkLocationAndNotify,
  createLocationNotificationChannel,
  requestLocationPermission,
  showLocationNotification,
  findMatchingTasks,
  clearReminderPlaceCache,
} from './LocationService';

const TASKS_STORAGE_KEY = '@virtus_tasks';
// Ключ для хранения времени последнего уведомления по типу места
const LAST_NOTIF_KEY = '@virtus_last_location_notif';
// Минимальный интервал между уведомлениями для одного типа места (1 час)
const NOTIF_COOLDOWN_MS = 60 * 60 * 1000;
// Интервал проверки геолокации (1 минута)
const CHECK_INTERVAL_MS = 60 * 1000;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

// ─── Проверка cooldown — не спамить уведомлениями ─────────────────────────
async function shouldNotify(placeType: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_NOTIF_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const lastTs = map[placeType] ?? 0;
    return Date.now() - lastTs > NOTIF_COOLDOWN_MS;
  } catch {
    return true;
  }
}

async function markNotified(placeType: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_NOTIF_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[placeType] = Date.now();
    await AsyncStorage.setItem(LAST_NOTIF_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

let currentCheck: Promise<void> | null = null;
export function checkBackgroundLocationOnce(): Promise<void> {
  if (currentCheck) return currentCheck;
  currentCheck = runBackgroundLocationCheck().finally(() => { currentCheck = null; });
  return currentCheck;
}

async function runBackgroundLocationCheck(): Promise<void> {
  const raw = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
  const tasks: Task[] = raw ? JSON.parse(raw) : [];
  const readSettings = async () => ({ notifications: true, quietHoursStart: '22:00', quietHoursEnd: '08:00',
    ...JSON.parse(await AsyncStorage.getItem('@virtus_settings') || '{}') });
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!canNotify(await readSettings()) || !tasks.some(t => !t.completed && t.date === today)) return;
  const result = await checkLocationAndNotify(tasks, false);
  if (!result.matchedTasks.length) return;
  // A task or setting may have changed while the map request was in flight.
  const latestTasks: Task[] = JSON.parse(await AsyncStorage.getItem(TASKS_STORAGE_KEY) || '[]');
  const matchedTasks = findMatchingTasks(result.location, latestTasks);
  if (!matchedTasks.length || !canNotify(await readSettings())) return;
  const eligibleTasks = [];
  for (const task of matchedTasks) {
    if (await shouldNotify(`${today}:${task.id}`)) eligibleTasks.push(task);
  }
  if (!eligibleTasks.length) return;
  showLocationNotification(eligibleTasks, result.location.placeName);
  for (const task of eligibleTasks) await markNotified(`${today}:${task.id}`);
}

// ─── Фоновая задача ────────────────────────────────────────────────────────
const backgroundLocationTask = async (taskData?: { delay: number }) => {
  const delay = taskData?.delay ?? CHECK_INTERVAL_MS;

  while (BackgroundService.isRunning()) {
    try {
      await checkBackgroundLocationOnce();
      if (BackgroundService.isRunning()) await BackgroundService.updateNotification({ taskDesc: '📍 Напоминания рядом с магазинами включены' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось проверить местоположение';
      console.warn('[GeoReminder]', message);
      if (BackgroundService.isRunning()) {
        await BackgroundService.updateNotification({ taskDesc: message }).catch(() => {});
      }
    }

    await sleep(delay);
  }
};

// ─── Опции сервиса ─────────────────────────────────────────────────────────
const SERVICE_OPTIONS = {
  taskName: 'VirtusLocationCheck',
  taskTitle: 'VirtusPlanner',
  taskDesc: '📍 Умные напоминания по геолокации включены',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#087F8C',
  foregroundServiceType: ['location'] as ['location'],
  parameters: {
    delay: CHECK_INTERVAL_MS,
  },
};

// ─── Публичное API ─────────────────────────────────────────────────────────

let starting: Promise<void> | null = null;
let serviceGeneration = 0;
export function startBackgroundLocationService(): Promise<void> {
  if (starting) return starting;
  starting = startLocationService(serviceGeneration).finally(() => { starting = null; });
  return starting;
}

async function startLocationService(generation: number): Promise<void> {
  if (Platform.OS !== 'android' || AppState.currentState !== 'active') return;
  if (BackgroundService.isRunning()) return;

  createLocationNotificationChannel();
  const permitted = await requestLocationPermission();
  if (!permitted || generation !== serviceGeneration || AppState.currentState !== 'active') return;
  const settings = JSON.parse(await AsyncStorage.getItem('@virtus_settings') || '{}');
  if (settings.notifications === false || generation !== serviceGeneration) return;

  try {
    await BackgroundService.start(backgroundLocationTask, SERVICE_OPTIONS);
    if (generation !== serviceGeneration) await BackgroundService.stop();
  } catch {
    // На iOS или при отсутствии разрешений — тихо игнорируем
  }
}

export async function stopBackgroundLocationService(): Promise<void> {
  serviceGeneration++;
  clearReminderPlaceCache();
  if (!BackgroundService.isRunning()) return;
  try {
    await BackgroundService.stop();
  } catch {
    // ignore
  }
}

export function isBackgroundServiceRunning(): boolean {
  return BackgroundService.isRunning();
}
