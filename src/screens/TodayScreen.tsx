import React, { useState, useEffect, useRef, useCallback } from "react";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, AppState, AppStateStatus } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { rw, rh, rf, ms } from "../utils/responsive";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp, getTodayStr } from "../store/AppContext";
import { useNavigationSpace } from "../navigation/useNavigationSpace";
import { useTheme } from "../store/theme";
import { scheduleTimerNotification, cancelTimerNotification, showTimerFinishedNotification, cancelTaskNotifications, scheduleTaskStartNotification, showOngoingTimerNotification, cancelOngoingTimerNotification, scheduleBackgroundTimerUpdates, cancelBackgroundTimerUpdates } from "../services/NotificationService";

const TIMER_STORAGE_KEY = '@virtus_active_timer';

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 6) return 'Доброй ночи!';
    if (h < 12) return 'Доброе утро!';
    if (h < 18) return 'Добрый день!';
    return 'Добрый вечер!';
}

function getDateString(): string {
    const d = new Date();
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function formatEndTime(time: string, duration: number): string {
    const [h, m] = time.split(':').map(Number);
    const totalMin = h * 60 + m + duration;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

const CATEGORY_COLORS: Record<string, string> = {
    'Работа': '#6366f1',
    'Личное': '#8b5cf6',
    'Обучение': '#10b981',
    'Отдых': '#f59e0b',
    'Другое': '#94a3b8',
};

const TodayScreen = () => {
    const { tasks, settings, getTodayTasks, getFocusTask, updateTask, toggleTaskComplete } = useApp();
    const { colors } = useTheme();
    const navigationSpace = useNavigationSpace();
    const [focusActive, setFocusActive] = useState(false);
    const [remaining, setRemaining] = useState(0); // seconds remaining
    const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
    const [totalDuration, setTotalDuration] = useState(0); // total seconds
    const [notificationId, setNotificationId] = useState<number | null>(null);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    const todayTasks = getTodayTasks();
    const focusTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) ?? null : getFocusTask();
    const completedCount = todayTasks.filter(t => t.completed).length;
    const totalCount = todayTasks.length;

    useEffect(() => {
        if (!settings.notifications) {
            if (notificationId) cancelTimerNotification(notificationId);
            cancelOngoingTimerNotification();
            cancelBackgroundTimerUpdates();
        }
    }, [settings.notifications, notificationId]);

    // Restore timer state from AsyncStorage on mount
    useEffect(() => {
        const restoreTimer = async () => {
            try {
                const saved = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
                if (saved) {
                    const data = JSON.parse(saved);
                    const now = Date.now();
                    const elapsed = (now - data.startTimestamp) / 1000;
                    const left = data.totalDuration - elapsed;
                    const savedTask = tasks.find(t => t.id === data.taskId);
                    if (left > 0 && savedTask && !savedTask.completed) {
                        setActiveTaskId(data.taskId);
                        setStartTimestamp(data.startTimestamp);
                        setTotalDuration(data.totalDuration);
                        setNotificationId(data.notificationId);
                        setRemaining(Math.ceil(left));
                        setFocusActive(true);
                    } else {
                        // Timer expired while app was closed
                        await AsyncStorage.removeItem(TIMER_STORAGE_KEY);
                        if (left <= 0 && savedTask && !savedTask.completed) {
                            updateTask(data.taskId, { completed: true });
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to restore timer:', e);
            }
        };
        restoreTimer();
    }, []);

    // Interval to update remaining time every second
    useEffect(() => {
        if (focusActive && startTimestamp) {
            timerRef.current = setInterval(() => {
                const now = Date.now();
                const elapsed = (now - startTimestamp) / 1000;
                const left = totalDuration - elapsed;
                if (left <= 0) {
                    // Timer finished
                    setRemaining(0);
                    setFocusActive(false);
                    setStartTimestamp(null);
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = null;
                    AsyncStorage.removeItem(TIMER_STORAGE_KEY);
                    cancelOngoingTimerNotification();
                    cancelBackgroundTimerUpdates();
                    if (focusTask) {
                        if (settings.notifications) showTimerFinishedNotification(focusTask.title);
                        if (notificationId) cancelTimerNotification(notificationId);
                        updateTask(focusTask.id, { completed: true });
                    }
                    setActiveTaskId(null);
                } else {
                    const secs = Math.ceil(left);
                    setRemaining(secs);
                    if (focusTask && settings.notifications) {
                        showOngoingTimerNotification(focusTask.title, secs);
                    }
                }
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [focusActive, startTimestamp, totalDuration, focusTask, notificationId, settings.notifications, updateTask]);

    // Handle AppState changes (background/foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
                // App going to background - schedule notification updates
                if (startTimestamp && focusActive && focusTask && settings.notifications) {
                    scheduleBackgroundTimerUpdates(focusTask.title, startTimestamp, totalDuration);
                }
            }
            if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
                // App came to foreground - cancel scheduled bg updates, recalculate
                cancelBackgroundTimerUpdates();
                if (startTimestamp && focusActive) {
                    const now = Date.now();
                    const elapsed = (now - startTimestamp) / 1000;
                    const left = totalDuration - elapsed;
                    if (left <= 0) {
                        setRemaining(0);
                        setFocusActive(false);
                        setStartTimestamp(null);
                        AsyncStorage.removeItem(TIMER_STORAGE_KEY);
                        cancelOngoingTimerNotification();
                        if (focusTask) {
                            if (settings.notifications) showTimerFinishedNotification(focusTask.title);
                            if (notificationId) cancelTimerNotification(notificationId);
                            updateTask(focusTask.id, { completed: true });
                        }
                        setActiveTaskId(null);
                    } else {
                        setRemaining(Math.ceil(left));
                    }
                }
            }
            appStateRef.current = nextState;
        });
        return () => subscription.remove();
    }, [startTimestamp, totalDuration, focusActive, focusTask, notificationId, settings.notifications, updateTask]);

    useEffect(() => {
        if (activeTaskId && (!focusTask || focusTask.completed)) {
            if (notificationId) cancelTimerNotification(notificationId);
            cancelOngoingTimerNotification();
            cancelBackgroundTimerUpdates();
            AsyncStorage.removeItem(TIMER_STORAGE_KEY);
            setFocusActive(false);
            setStartTimestamp(null);
            setActiveTaskId(null);
        }
    }, [activeTaskId, focusTask, notificationId]);

    const handleStartFocus = useCallback(() => {
        if (focusActive) {
            // Stop timer
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            if (notificationId) {
                cancelTimerNotification(notificationId);
                setNotificationId(null);
            }
            cancelBackgroundTimerUpdates();
            setFocusActive(false);
            setRemaining(0);
            setStartTimestamp(null);
            setTotalDuration(0);
            setActiveTaskId(null);
            AsyncStorage.removeItem(TIMER_STORAGE_KEY);
            cancelOngoingTimerNotification();
            // Re-schedule task end notification since timer was stopped manually
            if (focusTask && settings.notifications) {
                scheduleTaskStartNotification(focusTask.id, focusTask.title, focusTask.category, focusTask.date, focusTask.time, focusTask.duration, settings);
            }
        } else if (focusTask) {
            // Start countdown timer based on task duration
            const durationSec = focusTask.duration * 60;
            const now = Date.now();
            setActiveTaskId(focusTask.id);
            setStartTimestamp(now);
            setTotalDuration(durationSec);
            setRemaining(durationSec);
            setFocusActive(true);

            // Cancel task's scheduled end notification (timer handles it)
            cancelTaskNotifications(focusTask.id);

            // Show ongoing notification
            if (settings.notifications) showOngoingTimerNotification(focusTask.title, durationSec);

            // Schedule notification for when timer ends
            const nId = settings.notifications ? scheduleTimerNotification(focusTask.title, durationSec * 1000) : null;
            setNotificationId(nId);

            // Persist timer state
            AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
                startTimestamp: now,
                totalDuration: durationSec,
                taskId: focusTask.id,
                notificationId: nId,
            }));
        }
    }, [focusActive, focusTask, notificationId, settings]);

    const handleCompleteFocus = useCallback(() => {
        if (focusTask) {
            updateTask(focusTask.id, { completed: true });
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            if (notificationId) {
                cancelTimerNotification(notificationId);
                setNotificationId(null);
            }
            cancelBackgroundTimerUpdates();
            cancelOngoingTimerNotification();
            setFocusActive(false);
            setRemaining(0);
            setStartTimestamp(null);
            setTotalDuration(0);
            setActiveTaskId(null);
            AsyncStorage.removeItem(TIMER_STORAGE_KEY);
        }
    }, [focusTask, updateTask, notificationId]);

    const formatTimer = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: navigationSpace + rh(24) }]}>

                {/* Заголовок */}
                <View style={styles.header}>
                    <Text style={{ color: colors.textMuted, fontSize: rf(13), marginBottom: 5 }}>{getGreeting()}</Text>
                    <Text style={[styles.greeting, { color: colors.text }]}>Ваш день</Text>
                    <Text style={[styles.date, { color: colors.textMuted }]}>{getDateString()}</Text>
                </View>

                {/* Карточка фокуса */}
                {focusTask ? (
                    <View style={[styles.focusCard, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                        <Text style={[styles.focusLabel, { color: colors.accentText }]}>ФОКУС ДНЯ</Text>
                        <Text style={[styles.focusTitle, { color: colors.textSecondary }]}>{focusTask.title}</Text>
                        <Text style={[styles.focusTime, { color: colors.accentText }]}>
                            {focusTask.time} - {formatEndTime(focusTask.time, focusTask.duration)}
                        </Text>

                        {focusActive && (
                            <Text style={[styles.timerText, { color: colors.text }]}>{formatTimer(remaining)}</Text>
                        )}

                        <View style={styles.focusButtons}>
                            <TouchableOpacity
                                style={[styles.startButton, { backgroundColor: colors.accent }, focusActive && styles.stopButton]}
                                onPress={handleStartFocus}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.startButtonText}>
                                    {focusActive ? 'Остановить' : 'Начать'}
                                </Text>
                            </TouchableOpacity>

                            {focusActive && (
                                <TouchableOpacity
                                    style={styles.completeButton}
                                    onPress={handleCompleteFocus}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.completeButtonText}>Выполнено ✓</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ) : (
                    <View style={[styles.focusCard, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                        <Text style={[styles.focusLabel, { color: colors.accentText }]}>ФОКУС ДНЯ</Text>
                        <Text style={[styles.focusTitle, { color: colors.textSecondary }]}>
                            {totalCount === 0 ? 'Нет задач на сегодня' : 'Все задачи выполнены!'}
                        </Text>
                        <Text style={[styles.focusTime, { color: colors.accentText }]}>
                            {totalCount === 0 ? 'Добавьте задачи во вкладке «Задачи»' : 'Отличная работа 🎉'}
                        </Text>
                    </View>
                )}

                {/* Прогресс дня */}
                <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.progressHeader}>
                        <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Прогресс дня</Text>
                        <Text style={[styles.progressCount, { color: colors.accentText }]}>{completedCount}/{totalCount}</Text>
                    </View>
                    <View style={[styles.progressBarBg, { backgroundColor: colors.progressBg }]}>
                        <View style={[styles.progressBarFill, { width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }]} />
                    </View>
                </View>

                <View style={styles.agendaHeader}>
                    <Text style={[styles.scheduleTitle, { color: colors.text }]}>Дела на сегодня</Text>
                    <Text style={{ color: colors.textMuted, fontSize: rf(13) }}>{totalCount - completedCount} осталось</Text>
                </View>
                {todayTasks.length === 0 ? (
                    <View style={[styles.agendaEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={{ color: colors.text, fontSize: rf(17), fontWeight: '600' }}>День пока свободен</Text>
                        <Text style={{ color: colors.textMuted, fontSize: rf(14), lineHeight: rf(21), marginTop: 6 }}>Создайте дело во вкладке «Задачи». Виртус поможет с планами, а о покупках напомнит рядом с магазином.</Text>
                    </View>
                ) : [...todayTasks].sort((a, b) => a.time.localeCompare(b.time)).map(task => (
                    <View key={task.id} style={styles.agendaRow}>
                        <View style={styles.agendaTime}>
                            <Text style={{ color: colors.text, fontSize: rf(14), fontWeight: '700' }}>{task.time}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: rf(11), marginTop: 4 }}>{task.duration} мин</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.agendaTask, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderLeftColor: CATEGORY_COLORS[task.category] }]}
                            onPress={() => toggleTaskComplete(task.id)} activeOpacity={0.75}
                            accessibilityLabel={`${task.title}, ${task.completed ? 'выполнено' : 'отметить выполненным'}`}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.scheduleTaskTitle, { color: colors.text }, task.completed && styles.scheduleTaskTitleCompleted]}>{task.title}</Text>
                                <Text style={{ color: colors.textMuted, marginTop: 5, fontSize: rf(12) }}>{task.category} · до {formatEndTime(task.time, task.duration)}</Text>
                            </View>
                            <Text style={{ color: task.completed ? '#10b981' : colors.textMuted, fontSize: 22 }}>{task.completed ? '✓' : '○'}</Text>
                        </TouchableOpacity>
                    </View>
                ))}

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scrollContent: {
        paddingBottom: rh(40),
    },
    header: {
        marginTop: rh(20),
        alignItems: "flex-start",
        paddingHorizontal: rw(20),
    },
    greeting: {
        fontSize: rf(28),
        fontWeight: "600",
        color: "#0f172a",
    },
    date: {
        fontSize: rf(16),
        color: "#64748b",
        marginTop: rh(4),
    },
    progressCard: {
        marginHorizontal: rw(20),
        marginTop: 0,
        padding: ms(16),
        borderRadius: ms(16),
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    progressHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: rh(10),
    },
    progressLabel: {
        fontSize: rf(14),
        fontWeight: "600",
        color: "#64748b",
    },
    progressCount: {
        fontSize: rf(14),
        fontWeight: "700",
        color: "#6366f1",
    },
    progressBarBg: {
        height: rh(8),
        backgroundColor: "#e2e8f0",
        borderRadius: ms(4),
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: "#10b981",
        borderRadius: ms(4),
    },
    focusCard: {
        backgroundColor: "#f8fafc",
        margin: rw(20),
        padding: ms(20),
        borderRadius: ms(26),
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    focusLabel: {
        fontSize: rf(12),
        fontWeight: "700",
        color: "#6366f1",
        letterSpacing: 1,
        marginBottom: rh(8),
    },
    focusTitle: {
        fontSize: rf(20),
        fontWeight: "600",
        color: "#1e293b",
        marginBottom: rh(8),
    },
    focusTime: {
        fontSize: rf(16),
        color: "#6366f1",
        marginBottom: rh(12),
    },
    timerText: {
        fontSize: rf(36),
        fontWeight: "700",
        color: "#0f172a",
        textAlign: "center",
        marginBottom: rh(16),
        fontVariant: ['tabular-nums'],
    },
    focusButtons: {
        gap: rh(10),
    },
    startButton: {
        backgroundColor: "#6366f1",
        paddingVertical: rh(14),
        borderRadius: ms(12),
        alignItems: "center",
    },
    stopButton: {
        backgroundColor: "#ef4444",
    },
    startButtonText: {
        color: "#fff",
        fontSize: rf(16),
        fontWeight: "600",
    },
    completeButton: {
        backgroundColor: "#10b981",
        paddingVertical: rh(14),
        borderRadius: ms(12),
        alignItems: "center",
    },
    completeButtonText: {
        color: "#fff",
        fontSize: rf(16),
        fontWeight: "600",
    },
    agendaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: rw(20), marginTop: rh(24), marginBottom: rh(14) },
    agendaEmpty: { marginHorizontal: rw(20), padding: ms(20), borderWidth: 1, borderRadius: ms(22) },
    agendaRow: { flexDirection: "row", marginHorizontal: rw(20), marginBottom: rh(12), alignItems: "center", gap: rw(12) },
    agendaTime: { width: rw(48) },
    agendaTask: { flex: 1, flexDirection: "row", alignItems: "center", padding: ms(16), borderRadius: ms(18), borderWidth: 1, borderLeftWidth: 4, gap: 10 },
    scheduleTitle: {
        fontSize: rf(20),
        fontWeight: "700",
        color: "#0f172a",

        marginBottom: rh(20),
    },
    scheduleContainer: {
        paddingHorizontal: rw(20),
    },
    timeList: {
        flex: 1,
    },
    timeRow: {
        minHeight: rh(50),
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: rh(4),
    },
    timeText: {
        fontSize: rf(14),
        color: "#94a3b8",
        width: rw(50),
        paddingTop: rh(2),
    },
    timeContent: {
        flex: 1,
        marginLeft: rw(10),
    },
    timeDivider: {
        height: 1,
        backgroundColor: "#f1f5f9",
    },
    scheduleTask: {
        backgroundColor: "#fff",
        padding: ms(12),
        borderRadius: ms(12),
        marginTop: rh(4),
        borderLeftWidth: 4,
        borderLeftColor: "#6366f1",
        borderWidth: 1,
        borderColor: "#f1f5f9",
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    scheduleTaskCompleted: {
        opacity: 0.5,
    },
    scheduleTaskTitle: {
        fontSize: rf(15),
        fontWeight: "600",
        color: "#1e293b",
    },
    scheduleTaskTitleCompleted: {
        textDecorationLine: "line-through",
        color: "#94a3b8",
    },
    scheduleTaskTime: {
        fontSize: rf(13),
        color: "#64748b",
        marginTop: rh(4),
    },
});

export default TodayScreen;
