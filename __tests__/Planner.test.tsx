import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import { AppProvider, useApp, getDateStr } from '../src/store/AppContext';
import { canNotify } from '../src/utils/notificationPolicy';
import { parseAIResponse } from '../src/services/AIService';
import { Task } from '../src/store/types';

const settings = { darkMode: false, notifications: true, quietHoursStart: '22:00', quietHoursEnd: '08:00' };
const task: Omit<Task, 'id' | 'createdAt'> = { title: 'Тестовая задача', category: 'Работа', date: getDateStr(1), time: '12:00', duration: 60, priority: 'medium', completed: false };
let app: ReturnType<typeof useApp>;
const Probe = () => { app = useApp(); return null; };
let tree: Renderer.ReactTestRenderer;
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  await act(async () => { tree = Renderer.create(<AppProvider><Probe /></AppProvider>); });
});
afterEach(() => act(() => tree.unmount()));

test('add/edit/complete/delete persists and cancels reminders', async () => {
  await act(async () => app.addTask(task));
  const id = app.tasks[0].id;
  await act(async () => app.updateTask(id, { title: 'Изменено', duration: 90 }));
  expect(app.tasks[0].title).toBe('Изменено');
  await act(async () => app.updateTask(id, { completed: true }));
  expect(JSON.parse((await AsyncStorage.getItem('@virtus_tasks'))!)[0].completed).toBe(true);
  expect(PushNotification.cancelLocalNotification).toHaveBeenCalled();
  await act(async () => app.deleteTask(id));
  expect(app.tasks).toHaveLength(0);
});
test('turning notifications off cancels scheduled reminders', async () => {
  await act(async () => app.addTask(task));
  jest.clearAllMocks();
  await act(async () => app.updateSettings({ notifications: false }));
  expect(PushNotification.cancelLocalNotification).toHaveBeenCalledTimes(2);
  expect(PushNotification.localNotificationSchedule).not.toHaveBeenCalled();
});
test('day analytics excludes yesterday and tomorrow', async () => {
  await act(async () => {
    app.addTask({ ...task, date: getDateStr(-1), completed: true });
    app.addTask({ ...task, date: getDateStr(0) });
    app.addTask(task);
  });
  expect(app.getCompletionRate(1)).toBe(0);
  expect(app.getCategoryStats(1)).toEqual([{ label: 'Работа', value: 100, color: '#6366f1' }]);
});
test('clearing data cancels reminders and removes timer state', async () => {
  await AsyncStorage.setItem('@virtus_active_timer', '{}');
  await act(async () => app.clearAllData());
  expect(PushNotification.cancelAllLocalNotifications).toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@virtus_active_timer')).toBeNull();
});
test.each([[7, false], [8, true], [21, true], [22, false]])('quiet hours at %s', (hour, expected) => {
  expect(canNotify(settings, new Date(2026, 9, 7, hour))).toBe(expected);
});
test('AI JSON parser handles braces inside a quoted message', () => {
  expect(parseAIResponse('Ответ: {"message":"Название {задачи} и }", "action":"NONE"}').text).toBe('Название {задачи} и }');
});
