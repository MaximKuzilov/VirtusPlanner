import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp, getDateStr } from '../src/store/AppContext';
import TasksScreen from '../src/screens/TasksScreen';
import AssistantScreen from '../src/screens/AssistantScreen';
import TodayScreen from '../src/screens/TodayScreen';
import { answerLocationQuery } from '../src/services/LocationService';
import { parseLocalTask, validateTask } from '../src/utils/taskValidation';

jest.mock('../src/services/LocationService', () => ({
  ...jest.requireActual('../src/services/LocationService'), answerLocationQuery: jest.fn(),
}));
let app: ReturnType<typeof useApp>;
const Probe = () => { app = useApp(); return null; };
let tree: Renderer.ReactTestRenderer;
const mount = async (screen: React.ReactNode) => {
  await AsyncStorage.clear();
  await act(async () => { tree = Renderer.create(<AppProvider><Probe />{screen}</AppProvider>); });
};
const newTask = { title: 'Тест', category: 'Работа' as const, date: getDateStr(0), time: '23:59', duration: 1, priority: 'medium' as const, completed: false };
afterEach(() => { if (tree) act(() => tree.unmount()); jest.useRealTimers(); });

test('calendar counts selected date by category, including zero, and respects search', async () => {
  await mount(<TasksScreen />);
  await act(async () => {
    app.addTask(newTask);
    app.addTask({ ...newTask, title: 'Покупки', category: 'Личное' });
    app.addTask({ ...newTask, date: getDateStr(1) });
  });
  const filters = () => tree.root.findAllByType(TouchableOpacity).filter(button =>
    button.findAllByType(Text).some(text => ['Все', 'Работа', 'Личное', 'Обучение'].includes(text.props.children)));
  expect(filters().slice(0, 4).map(b => b.findAllByType(Text)[0].props.children)).toEqual([2, 1, 1, 0]);
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('  Покупки  '));
  expect(filters().slice(0, 4).map(b => b.findAllByType(Text)[0].props.children)).toEqual([1, 0, 1, 0]);
});
test('nearby quick action sends its own text and displays the location result', async () => {
  (answerLocationQuery as jest.Mock).mockResolvedValue('Магазин рядом — 100 м');
  await mount(<AssistantScreen />);
  const button = tree.root.findAllByType(TouchableOpacity).find(b => b.findAllByType(Text).some(t => t.props.children === '📍 Магазины рядом'))!;
  await act(async () => button.props.onPress());
  expect(answerLocationQuery).toHaveBeenCalledWith('shops');
  expect(tree.root.findAllByType(Text).some(t => t.props.children === 'Магазин рядом — 100 м')).toBe(true);
});
test('location errors appear as a chat message', async () => {
  (answerLocationQuery as jest.Mock).mockRejectedValue(new Error('Нет доступа к геолокации'));
  await mount(<AssistantScreen />);
  const button = tree.root.findAllByType(TouchableOpacity).find(b => b.findAllByType(Text).some(t => t.props.children === '📍 Магазины рядом'))!;
  await act(async () => button.props.onPress());
  expect(tree.root.findAllByType(Text).some(t => typeof t.props.children === 'string' && t.props.children.includes('Нет доступа к геолокации'))).toBe(true);
});
test('timer completes the started task even after a higher priority task is added', async () => {
  await mount(<TodayScreen />);
  await act(async () => app.addTask(newTask));
  const id = app.tasks[0].id;
  jest.useFakeTimers();
  const start = tree.root.findAllByType(TouchableOpacity).find(b => b.findAllByType(Text).some(t => t.props.children === 'Начать'));
  expect(start).toBeDefined();
  await act(async () => start!.props.onPress());
  await act(async () => app.addTask({ ...newTask, title: 'Срочно', priority: 'high' }));
  await act(async () => jest.advanceTimersByTime(61000));
  expect(app.tasks.find(t => t.id === id)?.completed).toBe(true);
  expect(app.tasks.find(t => t.title === 'Срочно')?.completed).toBe(false);
});
test('offline add recognizes tomorrow and rejects invalid time', () => {
  const parsed = parseLocalTask('Добавь задачу Купить молоко завтра в 14:30', new Date(2026, 9, 7));
  expect(parsed).toMatchObject({ title: 'Купить молоко', date: '2026-10-08', time: '14:30' });
  expect(typeof parseLocalTask('Добавь задачу Тест в 25:99')).toBe('string');
  expect(validateTask({ ...newTask, date: '2026-02-30' })).toBe('Такой даты не существует.');
});
