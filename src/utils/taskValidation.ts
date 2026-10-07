import { Task } from '../store/types';

export function validateTask(task: Omit<Task, 'id' | 'createdAt'>): string | null {
  if (typeof task.title !== 'string' || !task.title.trim()) return 'Введите название задачи.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(task.date)) return 'Некорректная дата задачи.';
  const [year, month, day] = task.date.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return 'Такой даты не существует.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time)) return 'Время должно быть от 00:00 до 23:59.';
  if (!Number.isInteger(task.duration) || task.duration < 1 || task.duration > 1440) return 'Длительность должна быть от 1 до 1440 минут.';
  if (!['Работа', 'Личное', 'Обучение', 'Отдых', 'Другое'].includes(task.category)) return 'Неизвестная категория задачи.';
  if (!['high', 'medium', 'low'].includes(task.priority)) return 'Неизвестный приоритет задачи.';
  return null;
}

export function parseLocalTask(text: string, today = new Date()): Omit<Task, 'id' | 'createdAt'> | string {
  let title = text.trim().replace(/^(добав(?:ь|ить|ьте)?|создай|запланируй)(?:\s+задач[уи])?\s*/i, '').replace(/^новая задача\s*/i, '');
  const date = new Date(today);
  if (/послезавтра/i.test(title)) date.setDate(date.getDate() + 2);
  else if (/завтра/i.test(title)) date.setDate(date.getDate() + 1);
  title = title.replace(/послезавтра|завтра|сегодня/gi, '').trim();
  const match = title.match(/(?:в\s+)?(\d{1,2})[:.](\d{2})|в\s+(\d{1,2})(?!\d)/i);
  const time = match ? `${String(Number(match[1] ?? match[3])).padStart(2, '0')}:${match[2] ?? '00'}` : '12:00';
  if (match) title = title.replace(match[0], '').trim();
  title = title.replace(/\s+/g, ' ');
  let category: Task['category'] = 'Другое';
  if (/работ|встреч|созвон|проект|презентац|отчет|клиент/i.test(title)) category = 'Работа';
  else if (/купить|магазин|дом|семь|друг|личн/i.test(title)) category = 'Личное';
  else if (/учи|изуч|курс|экзамен|книг|лекц|семинар/i.test(title)) category = 'Обучение';
  else if (/трениров|спорт|прогулк|отдых|йога|бег/i.test(title)) category = 'Отдых';
  const task = { title: title.charAt(0).toUpperCase() + title.slice(1), category, time,
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    duration: 60, priority: 'medium' as const, completed: false };
  return validateTask(task) || task;
}
