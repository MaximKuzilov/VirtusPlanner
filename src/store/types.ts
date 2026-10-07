export type TaskCategory = 'Работа' | 'Личное' | 'Обучение' | 'Отдых' | 'Другое';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // minutes
  priority: TaskPriority;
  completed: boolean;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  email: string;
}

export interface AppSettings {
  darkMode: boolean;
  notifications: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}
