import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Task, TaskCategory, TaskPriority, UserProfile, AppSettings } from './types';
import { scheduleTaskStartNotification, cancelTaskNotifications as cancelTaskNotifs } from '../services/NotificationService';
import PushNotification from 'react-native-push-notification';
import { startBackgroundLocationService, stopBackgroundLocationService } from '../services/BackgroundLocationService';

const STORAGE_KEYS = {
  TASKS: '@virtus_tasks',
  SETTINGS: '@virtus_settings',
  PROFILE: '@virtus_profile',
  ONBOARDING: '@virtus_onboarding',
};

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  notifications: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

const DEFAULT_PROFILE: UserProfile = {
  name: 'Пользователь',
  email: '',
};

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SAMPLE_TASKS: Task[] = [];

interface AppContextType {
  tasks: Task[];
  settings: AppSettings;
  profile: UserProfile;
  onboardingCompleted: boolean;
  isLoading: boolean;
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskComplete: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  clearAllData: () => void;
  getTasksForDate: (date: string) => Task[];
  getTodayTasks: () => Task[];
  getFocusTask: () => Task | null;
  getCompletionRate: (days?: number) => number;
  getCategoryStats: (days?: number) => { label: string; value: number; color: string }[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksStr, settingsStr, profileStr, onboardStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TASKS),
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
      ]);

      if (tasksStr) setTasks(JSON.parse(tasksStr));
      else setTasks([]);

      if (settingsStr) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(settingsStr) });
      if (profileStr) setProfile(JSON.parse(profileStr));
      if (onboardStr) setOnboardingCompleted(JSON.parse(onboardStr));
    } catch (e) {
      console.error('Failed to load data:', e);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const scheduleTaskNotification = useCallback((task: Task) => {
    if (settings.notifications && !task.completed) {
      scheduleTaskStartNotification(
        task.id,
        task.title,
        task.category,
        task.date,
        task.time,
        task.duration,
        settings,
      );
    }
  }, [settings]);

  const cancelTaskNotifications = useCallback((taskId: string) => {
    cancelTaskNotifs(taskId);
  }, []);

  // Schedule notifications for existing tasks when settings or tasks change
  useEffect(() => {
    let cancelled = false;
    const syncNotifications = async () => {
      if (isLoading) return;
      const rawTimer = await AsyncStorage.getItem('@virtus_active_timer');
      if (cancelled) return;
      let activeTaskId: string | undefined;
      try { activeTaskId = rawTimer ? JSON.parse(rawTimer).taskId : undefined; } catch { /* no valid active timer */ }
      tasks.forEach(task => {
        cancelTaskNotifs(task.id);
        if (!task.completed && task.id !== activeTaskId) {
          scheduleTaskNotification(task);
        }
      });
    };
    syncNotifications().catch(error => console.error('Failed to sync reminders:', error));
    return () => { cancelled = true; };
  }, [tasks, isLoading, scheduleTaskNotification]);

  useEffect(() => {
    if (isLoading) return;
    if (!onboardingCompleted) { stopBackgroundLocationService().catch(() => {}); return; }
    if (settings.notifications) {
      startBackgroundLocationService().catch(() => {});
      const listener = AppState.addEventListener('change', state => {
        if (state === 'active') startBackgroundLocationService().catch(() => {});
      });
      return () => listener.remove();
    }
    else stopBackgroundLocationService().catch(() => {});
  }, [isLoading, onboardingCompleted, settings.notifications]);

  const saveTasks = async (newTasks: Task[]) => {
    setTasks(newTasks);
    await AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(newTasks));
  };

  const saveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
  };

  const saveProfile = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(newProfile));
  };

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => {
      const updated = [...prev, newTask];
      AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updated));
      return updated;
    });
    scheduleTaskNotification(newTask);
  }, [scheduleTaskNotification]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => {
      const oldTask = prev.find(t => t.id === id);
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updated));
      const newTask = updated.find(t => t.id === id);
      if (newTask && (updates.date || updates.time) && oldTask) {
        cancelTaskNotifications(id);
        scheduleTaskNotification(newTask);
      }
      return updated;
    });
  }, [scheduleTaskNotification, cancelTaskNotifications]);

  const deleteTask = useCallback((id: string) => {
    cancelTaskNotifications(id);
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updated));
      return updated;
    });
  }, [cancelTaskNotifications]);

  const toggleTaskComplete = useCallback((id: string) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
      AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updated));
      const task = updated.find(t => t.id === id);
      if (task) {
        if (task.completed) {
          cancelTaskNotifications(id);
        } else {
          scheduleTaskNotification(task);
        }
      }
      return updated;
    });
  }, [cancelTaskNotifications, scheduleTaskNotification]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      if (updates.notifications !== undefined) {
        console.log('[Settings] Notifications toggled:', updated.notifications);
      }
      return updated;
    });
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboardingCompleted(true);
    AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify(true));
  }, []);

  const clearAllData = useCallback(async () => {
    PushNotification.cancelAllLocalNotifications();
    await stopBackgroundLocationService();
    await AsyncStorage.multiRemove(['@virtus_active_timer', '@virtus_last_location_notif']);
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    setTasks([]);
    setSettings(DEFAULT_SETTINGS);
    setProfile(DEFAULT_PROFILE);
    setOnboardingCompleted(false);
  }, []);

  const getTasksForDate = useCallback((date: string) => {
    return tasks.filter(t => t.date === date).sort((a, b) => a.time.localeCompare(b.time));
  }, [tasks]);

  const getTodayTasks = useCallback(() => {
    return getTasksForDate(getTodayStr());
  }, [getTasksForDate]);

  const getFocusTask = useCallback(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayTasks = getTodayTasks().filter(t => {
      if (t.completed) return false;
      // Skip tasks whose time + duration has already passed
      const [h, m] = t.time.split(':').map(Number);
      const taskEndMinutes = h * 60 + m + t.duration;
      return currentMinutes < taskEndMinutes;
    });
    if (todayTasks.length === 0) return null;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    todayTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    return todayTasks[0];
  }, [getTodayTasks]);

  const getCompletionRate = useCallback((days: number = 7) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Math.max(0, days - 1));
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const relevant = tasks.filter(t => t.date >= cutoffStr && t.date <= getTodayStr());
    if (relevant.length === 0) return 0;
    const completed = relevant.filter(t => t.completed).length;
    return Math.round((completed / relevant.length) * 100);
  }, [tasks]);

  const getCategoryStats = useCallback((days?: number) => {
    const categoryColors: Record<string, string> = {
      'Работа': '#6366f1',
      'Личное': '#8b5cf6',
      'Обучение': '#10b981',
      'Отдых': '#f59e0b',
      'Другое': '#94a3b8',
    };
    const counts: Record<string, number> = {};
    let total = 0;
    const cutoff = days ? getDateStr(-(days - 1)) : '';
    tasks.filter(t => !days || (t.date >= cutoff && t.date <= getTodayStr())).forEach(t => {
      counts[t.category] = (counts[t.category] || 0) + 1;
      total++;
    });
    if (total === 0) return [];
    return Object.entries(counts)
      .map(([label, count]) => ({
        label,
        value: Math.round((count / total) * 100),
        color: categoryColors[label] || '#94a3b8',
      }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  return (
    <AppContext.Provider
      value={{
        tasks, settings, profile, onboardingCompleted, isLoading,
        addTask, updateTask, deleteTask, toggleTaskComplete,
        updateSettings, updateProfile, completeOnboarding, clearAllData,
        getTasksForDate, getTodayTasks, getFocusTask, getCompletionRate, getCategoryStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { getTodayStr, getDateStr };
