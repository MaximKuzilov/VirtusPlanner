import PushNotification from 'react-native-push-notification';
import { Platform, PermissionsAndroid } from 'react-native';
import { AppSettings } from '../store/types';
import { canNotify } from '../utils/notificationPolicy';

const CHANNEL_ID = 'virtus-timer-channel';
const TASK_CHANNEL_ID = 'virtus-task-channel';
const ONGOING_CHANNEL_ID = 'virtus-ongoing-channel';
const ONGOING_NOTIF_ID = '999999';

/**
 * Request POST_NOTIFICATIONS permission on Android 13+ (API 33+).
 * On older Android versions this is not needed — notifications are allowed by default.
 */
export async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  // API level 33 = Android 13
  if ((Platform.Version as number) < 33) return true;
  // Используем строку напрямую — PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  // может быть undefined в некоторых версиях React Native 0.73
  const POST_NOTIFICATIONS = (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS as string)
    ?? 'android.permission.POST_NOTIFICATIONS';
  try {
    const alreadyGranted = await PermissionsAndroid.check(POST_NOTIFICATIONS as any);
    if (alreadyGranted) return true;

    const result = await PermissionsAndroid.request(
      POST_NOTIFICATIONS as any,
      {
        title: 'Уведомления',
        message: 'Разрешите VirtusPlanner отправлять уведомления о задачах и таймерах.',
        buttonPositive: 'Разрешить',
        buttonNegative: 'Не сейчас',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function configureNotifications() {
  PushNotification.configure({
    onNotification: function (notification) {
      console.log('[Notification]', notification);
    },
    permissions: {
      alert: true,
      badge: true,
      sound: true,
    },
    popInitialNotification: true,
    requestPermissions: Platform.OS === 'ios',
  });

  PushNotification.createChannel(
    {
      channelId: CHANNEL_ID,
      channelName: 'Таймер задач',
      channelDescription: 'Уведомления о завершении таймера задач',
      importance: 4,
      vibrate: true,
      playSound: true,
    },
    (created: boolean) => console.log(`[Notification] Timer channel created: ${created}`),
  );

  PushNotification.createChannel(
    {
      channelId: TASK_CHANNEL_ID,
      channelName: 'Напоминания о задачах',
      channelDescription: 'Уведомления о начале запланированных задач',
      importance: 4,
      vibrate: true,
      playSound: true,
    },
    (created: boolean) => console.log(`[Notification] Task channel created: ${created}`),
  );

  PushNotification.createChannel(
    {
      channelId: ONGOING_CHANNEL_ID,
      channelName: 'Активный таймер',
      channelDescription: 'Показывает текущий таймер задачи',
      importance: 2, // LOW — no sound/vibration on updates
      vibrate: false,
      playSound: false,
    },
    (created: boolean) => console.log(`[Notification] Ongoing channel created: ${created}`),
  );
}

// --- Timer notifications (countdown) ---

export function scheduleTimerNotification(taskTitle: string, durationMs: number): number {
  const notificationId = Date.now() % 2000000000;
  const fireDate = new Date(Date.now() + durationMs);

  PushNotification.localNotificationSchedule({
    id: String(notificationId),
    channelId: CHANNEL_ID,
    title: '⏰ Время вышло!',
    message: `Задача "${taskTitle}" — время закончилось!`,
    date: fireDate,
    allowWhileIdle: true,
    importance: 'high',
    priority: 'high',
    vibrate: true,
    vibration: 500,
    playSound: true,
  });

  return notificationId;
}

export function cancelTimerNotification(notificationId: number) {
  PushNotification.cancelLocalNotification(String(notificationId));
}

export function showTimerFinishedNotification(taskTitle: string) {
  PushNotification.localNotification({
    channelId: CHANNEL_ID,
    title: '⏰ Время вышло!',
    message: `Задача "${taskTitle}" — время закончилось!`,
    importance: 'high',
    priority: 'high',
    vibrate: true,
    vibration: 500,
    playSound: true,
  });
}

// --- Ongoing timer notification (persistent while timer runs) ---

function formatTimeLeft(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function showOngoingTimerNotification(taskTitle: string, remainingSeconds: number) {
  PushNotification.localNotification({
    id: ONGOING_NOTIF_ID,
    channelId: ONGOING_CHANNEL_ID,
    title: `▶ ${taskTitle}`,
    message: `Осталось: ${formatTimeLeft(remainingSeconds)}`,
    ongoing: true,
    autoCancel: false,
    vibrate: false,
    playSound: false,
    importance: 'low',
    priority: 'low',
  });
}

export function cancelOngoingTimerNotification() {
  PushNotification.cancelLocalNotification(ONGOING_NOTIF_ID);
}

// Schedule ongoing notification updates for background (every 30 sec)
const ONGOING_BG_PREFIX = 888000;

export function scheduleBackgroundTimerUpdates(taskTitle: string, startTimestamp: number, totalDuration: number) {
  const now = Date.now();
  const elapsed = (now - startTimestamp) / 1000;
  const left = totalDuration - elapsed;
  if (left <= 0) return;

  // Schedule updates every 30 seconds
  const intervalSec = 30;
  const count = Math.min(Math.floor(left / intervalSec), 120); // max 120 updates (1 hour)

  for (let i = 1; i <= count; i++) {
    const futureMs = i * intervalSec * 1000;
    const remainAtThat = Math.ceil(left - i * intervalSec);
    if (remainAtThat <= 0) break;

    PushNotification.localNotificationSchedule({
      id: String(ONGOING_BG_PREFIX + i),
      channelId: ONGOING_CHANNEL_ID,
      title: `▶ ${taskTitle}`,
      message: `Осталось: ${formatTimeLeft(remainAtThat)}`,
      date: new Date(now + futureMs),
      allowWhileIdle: true,
      ongoing: false,
      autoCancel: false,
      vibrate: false,
      playSound: false,
      importance: 'low',
      priority: 'low',
    });
  }
}

export function cancelBackgroundTimerUpdates() {
  for (let i = 1; i <= 120; i++) {
    PushNotification.cancelLocalNotification(String(ONGOING_BG_PREFIX + i));
  }
}

// --- Task schedule notifications (start time reminders) ---

function taskNotifId(taskId: string, suffix: string): string {
  // Stable numeric ID from task ID string
  let hash = 0;
  const str = taskId + suffix;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash));
}

export function scheduleTaskStartNotification(taskId: string, taskTitle: string, taskCategory: string, date: string, time: string, durationMinutes: number, settings?: AppSettings) {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Notification at task start time
  const startDate = new Date(year, month - 1, day, hours, minutes, 0);
  const now = new Date();

  if (startDate.getTime() > now.getTime() && (!settings || canNotify(settings, startDate))) {
    PushNotification.localNotificationSchedule({
      id: taskNotifId(taskId, '_start'),
      channelId: TASK_CHANNEL_ID,
      title: '🚀 Пора начинать!',
      message: `${taskTitle} (${taskCategory}) — запланировано на ${time}`,
      date: startDate,
      allowWhileIdle: true,
      importance: 'high',
      priority: 'high',
      vibrate: true,
      vibration: 300,
      playSound: true,
    });
  }

  // Notification at task end time (start + duration)
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  if (endDate.getTime() > now.getTime() && (!settings || canNotify(settings, endDate))) {
    PushNotification.localNotificationSchedule({
      id: taskNotifId(taskId, '_end'),
      channelId: TASK_CHANNEL_ID,
      title: '✅ Время задачи истекло',
      message: `${taskTitle} — отведённое время (${durationMinutes} мин) закончилось`,
      date: endDate,
      allowWhileIdle: true,
      importance: 'high',
      priority: 'high',
      vibrate: true,
      vibration: 500,
      playSound: true,
    });
  }
}

export function cancelTaskNotifications(taskId: string) {
  PushNotification.cancelLocalNotification(taskNotifId(taskId, '_start'));
  PushNotification.cancelLocalNotification(taskNotifId(taskId, '_end'));
}
