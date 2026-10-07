import React, { useState, useMemo, useCallback } from "react";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp, getTodayStr } from "../store/AppContext";
import { useNavigationSpace } from "../navigation/useNavigationSpace";
import { useTheme } from "../store/theme";
import { Task, TaskCategory, TaskPriority } from "../store/types";
import { rw, rh, rf, ms } from "../utils/responsive";

const MONTHS_NAME = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const CATEGORY_COLORS: Record<string, string> = {
    'Работа': '#6366f1', 'Личное': '#8b5cf6', 'Обучение': '#10b981', 'Отдых': '#f59e0b', 'Другое': '#94a3b8'
};
const CATEGORIES: TaskCategory[] = ['Работа', 'Личное', 'Обучение', 'Отдых', 'Другое'];
const PRIORITIES: { label: string; value: TaskPriority }[] = [
    { label: 'Высокий', value: 'high' }, { label: 'Средний', value: 'medium' }, { label: 'Низкий', value: 'low' }
];

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1; // Mon=0
}

function toDateStr(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const TasksScreen = () => {
    const { tasks, addTask, updateTask, deleteTask, toggleTaskComplete, getTasksForDate } = useApp();
    const { colors } = useTheme();
    const navigationSpace = useNavigationSpace();
    const today = new Date();
    const [calendarExpanded, setCalendarExpanded] = useState(false);
    const [activeFilter, setActiveFilter] = useState("Все");
    const [searchText, setSearchText] = useState("");
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState(today.getDate());
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Add/Edit task form state
    const [newTitle, setNewTitle] = useState("");
    const [newCategory, setNewCategory] = useState<TaskCategory>("Работа");
    const [newHours, setNewHours] = useState("12");
    const [newMinutes, setNewMinutes] = useState("00");
    const [newDuration, setNewDuration] = useState("60");
    const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
    const [newDateYear, setNewDateYear] = useState(today.getFullYear());
    const [newDateMonth, setNewDateMonth] = useState(today.getMonth());
    const [newDateDay, setNewDateDay] = useState(today.getDate());

    const selectedDateStr = toDateStr(selectedYear, selectedMonth, selectedDay);
    const todayStr = getTodayStr();

    const filterCounts = useMemo(() => {
        const counts: Record<string, number> = { Все: 0 };
        for (const category of CATEGORIES) counts[category] = 0;
        const query = searchText.trim().toLowerCase();
        for (const task of tasks) {
            if (task.date !== selectedDateStr || !task.title.toLowerCase().includes(query)) continue;
            counts.Все++;
            counts[task.category]++;
        }
        return counts;
    }, [tasks, selectedDateStr, searchText]);

    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);

    // Calendar grid: empty cells + actual dates
    const calendarCells = useMemo(() => {
        const cells: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        return cells;
    }, [firstDay, daysInMonth]);

    // Tasks filtered
    const filteredTasks = useMemo(() => {
        let dateTasks = getTasksForDate(selectedDateStr);
        if (activeFilter !== "Все") {
            dateTasks = dateTasks.filter(t => t.category === activeFilter);
        }
        if (searchText.trim()) {
            const q = searchText.trim().toLowerCase();
            dateTasks = dateTasks.filter(t => t.title.toLowerCase().includes(q));
        }
        return dateTasks;
    }, [tasks, selectedDateStr, activeFilter, searchText, getTasksForDate]);

    // Count tasks per day for dots on calendar
    const taskCountByDay = useMemo(() => {
        const counts: Record<number, number> = {};
        tasks.forEach(t => {
            const [ty, tm, td] = t.date.split('-').map(Number);
            if (ty === selectedYear && tm === selectedMonth + 1) {
                counts[td] = (counts[td] || 0) + 1;
            }
        });
        return counts;
    }, [tasks, selectedYear, selectedMonth]);

    const navigatePeriod = (delta: number) => {
        if (calendarExpanded) { navigateMonth(delta); return; }
        const date = new Date(selectedYear, selectedMonth, selectedDay + delta * 7);
        setSelectedYear(date.getFullYear()); setSelectedMonth(date.getMonth()); setSelectedDay(date.getDate());
    };

    const navigateMonth = (delta: number) => {
        let m = selectedMonth + delta;
        let y = selectedYear;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        setSelectedMonth(m);
        setSelectedYear(y);
        setSelectedDay(1);
    };

    const resetForm = useCallback(() => {
        setNewTitle("");
        setNewHours("12");
        setNewMinutes("00");
        setNewDuration("60");
        setNewCategory("Работа");
        setNewPriority("medium");
        setEditingTask(null);
    }, []);

    const handleOpenEdit = useCallback((task: Task) => {
        const [y, m, d] = task.date.split('-').map(Number);
        const [th, tm] = task.time.split(':');
        setEditingTask(task);
        setNewTitle(task.title);
        setNewCategory(task.category);
        setNewHours(th);
        setNewMinutes(tm);
        setNewDuration(String(task.duration));
        setNewPriority(task.priority);
        setNewDateYear(y);
        setNewDateMonth(m - 1);
        setNewDateDay(d);
        setShowAddModal(true);
    }, []);

    const handleHoursChange = useCallback((text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned === '') { setNewHours(''); return; }
        const num = parseInt(cleaned);
        if (num > 23) { setNewHours('23'); return; }
        setNewHours(cleaned.slice(0, 2));
    }, []);

    const handleMinutesChange = useCallback((text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned === '') { setNewMinutes(''); return; }
        const num = parseInt(cleaned);
        if (num > 59) { setNewMinutes('59'); return; }
        setNewMinutes(cleaned.slice(0, 2));
    }, []);

    const handleSaveTask = useCallback(() => {
        if (!newTitle.trim()) {
            Alert.alert("Ошибка", "Введите название задачи");
            return;
        }
        const h = parseInt(newHours) || 0;
        const m = parseInt(newMinutes) || 0;
        if (h < 0 || h > 23 || m < 0 || m > 59) {
            Alert.alert("Ошибка", "Введите корректное время (0-23 часов, 0-59 минут)");
            return;
        }
        const newTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const duration = Number(newDuration);
        if (!Number.isInteger(duration) || duration <= 0 || duration > 1440) {
            Alert.alert('Ошибка', 'Длительность должна быть от 1 до 1440 минут');
            return;
        }
        const taskDateStr = toDateStr(newDateYear, newDateMonth, newDateDay);
        if (editingTask) {
            updateTask(editingTask.id, {
                title: newTitle.trim(),
                category: newCategory,
                date: taskDateStr,
                time: newTime,
                duration,
                priority: newPriority,
            });
        } else {
            addTask({
                title: newTitle.trim(),
                category: newCategory,
                date: taskDateStr,
                time: newTime,
                duration,
                priority: newPriority,
                completed: false,
            });
        }
        resetForm();
        setShowAddModal(false);
    }, [newTitle, newCategory, newHours, newMinutes, newDuration, newPriority, newDateYear, newDateMonth, newDateDay, addTask, updateTask, editingTask, resetForm]);

    const handleDeleteTask = useCallback((task: Task) => {
        Alert.alert(
            "Удалить задачу?",
            task.title,
            [
                { text: "Отмена", style: "cancel" },
                { text: "Удалить", style: "destructive", onPress: () => deleteTask(task.id) },
            ]
        );
    }, [deleteTask]);

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: navigationSpace + 16 }}>
                <View style={styles.pageHeader}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Задачи</Text>
                {/* Кнопка добавить */}
                <TouchableOpacity style={[styles.headerAddButton, { backgroundColor: colors.accent }]} onPress={() => {
                    resetForm();
                    setNewDateYear(selectedYear);
                    setNewDateMonth(selectedMonth);
                    setNewDateDay(selectedDay);
                    setShowAddModal(true);
                }}>
                    <Text style={styles.addButtonText}>＋ Новая</Text>
                </TouchableOpacity>

                </View>
                <Text style={{ color: colors.textMuted, fontSize: rf(14), marginHorizontal: rw(20), marginBottom: rh(20) }}>Ваши планы, день за днём</Text>

                {/* Мини-календарь */}
                <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.monthNav}>
                        <TouchableOpacity onPress={() => navigatePeriod(-1)}>
                            <Text style={[styles.monthNavBtn, { color: colors.accentText }]}>◀</Text>
                        </TouchableOpacity>
                        <Text style={[styles.monthTitle, { color: colors.text }]}>{MONTHS_NAME[selectedMonth]} {selectedYear}</Text>
                        <TouchableOpacity onPress={() => navigatePeriod(1)}>
                            <Text style={[styles.monthNavBtn, { color: colors.accentText }]}>▶</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TouchableOpacity onPress={() => { const date = new Date(); setSelectedYear(date.getFullYear()); setSelectedMonth(date.getMonth()); setSelectedDay(date.getDate()); }} style={{ padding: 8 }}>
                        <Text style={{ color: colors.accentText, fontSize: rf(12), fontWeight: '600' }}>Сегодня</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCalendarExpanded(!calendarExpanded)} style={{ alignSelf: 'flex-end', padding: 8, marginBottom: 4 }} accessibilityLabel="Развернуть или свернуть календарь">
                        <Text style={{ color: colors.accentText, fontSize: rf(12), fontWeight: '600' }}>{calendarExpanded ? 'Свернуть месяц ↑' : 'Весь месяц ↓'}</Text>
                    </TouchableOpacity>
                    </View>
                    {calendarExpanded ? <>
                    <View style={styles.daysRow}>
                        {days.map((day, i) => (
                            <Text key={i} style={[styles.dayLabel, { color: colors.textPlaceholder }]}>{day}</Text>
                        ))}
                    </View>
                    <View style={styles.calendarGrid}>
                        {calendarCells.map((day, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[
                                    styles.dateItem,
                                    day === selectedDay && { backgroundColor: colors.accent, borderRadius: 10 },
                                    day !== null && toDateStr(selectedYear, selectedMonth, day) === todayStr && day !== selectedDay && { borderWidth: 2, borderColor: colors.accent, borderRadius: 10 },
                                ]}
                                onPress={() => day && setSelectedDay(day)}
                                disabled={day === null}
                            >
                                {day !== null && (
                                    <>
                                        <Text style={[
                                            styles.dateText,
                                            { color: colors.text },
                                            day === selectedDay && styles.activeDateText,
                                        ]}>
                                            {day}
                                        </Text>
                                        {taskCountByDay[day] && day !== selectedDay ? (
                                            <View style={[styles.taskDot, { backgroundColor: colors.accent }]} />
                                        ) : null}
                                    </>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                    </> : <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        {Array.from({ length: 7 }, (_, i) => {
                            const selected = new Date(selectedYear, selectedMonth, selectedDay);
                            const monday = selectedDay - ((selected.getDay() + 6) % 7);
                            const date = new Date(selectedYear, selectedMonth, monday + i);
                            const active = date.getDate() === selectedDay && date.getMonth() === selectedMonth;
                            return <TouchableOpacity key={i} onPress={() => { setSelectedYear(date.getFullYear()); setSelectedMonth(date.getMonth()); setSelectedDay(date.getDate()); }} style={{ flex: 1, alignItems: 'center', paddingVertical: rh(12), borderRadius: ms(16), backgroundColor: active ? colors.accent : 'transparent' }}>
                                <Text style={{ color: active ? '#fff' : colors.textMuted, fontSize: rf(11), marginBottom: rh(8) }}>{days[i]}</Text>
                                <Text style={{ color: active ? '#fff' : colors.text, fontSize: rf(18), fontWeight: '700' }}>{date.getDate()}</Text>
                                <View style={{ height: 4, width: 4, borderRadius: 2, marginTop: 6, backgroundColor: tasks.some(t => t.date === toDateStr(date.getFullYear(), date.getMonth(), date.getDate())) ? active ? '#fff' : colors.accent : 'transparent' }} />
                            </TouchableOpacity>;
                        })}
                    </View>}
                </View>

                {/* Поиск */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={[styles.searchInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                        placeholder="Поиск задачи"
                        placeholderTextColor={colors.textPlaceholder}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>

                {/* Фильтры */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {["Все", ...CATEGORIES].map((filter) => (
                        <TouchableOpacity
                            key={filter}
                            style={[styles.filterChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, activeFilter === filter && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                            onPress={() => setActiveFilter(filter)}
                        >
                            <Text style={[styles.filterCount, { color: colors.textMuted }, activeFilter === filter && styles.filterTextActive]}>{filterCounts[filter] ?? 0}</Text>
                            <Text style={[styles.filterText, { color: colors.textMuted }, activeFilter === filter && styles.filterTextActive]}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Список задач */}
                <View style={styles.tasksHeader}>
                    <Text style={[styles.tasksTitle, { color: colors.text }]}>
                        {selectedDay} {MONTHS_GEN[selectedMonth]} ({filteredTasks.length})
                    </Text>
                </View>

                {filteredTasks.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={[styles.emptyText, { color: colors.textPlaceholder }]}>Нет задач на этот день</Text>
                    </View>
                ) : (
                    filteredTasks.map((task) => (
                        <TouchableOpacity
                            key={task.id}
                            style={[styles.taskItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                            onPress={() => handleOpenEdit(task)}
                            onLongPress={() => handleDeleteTask(task)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.categoryIndicator, { backgroundColor: CATEGORY_COLORS[task.category] || '#94a3b8' }]} />
                            <View style={styles.taskInfo}>
                                <Text style={[styles.taskTitle, { color: colors.textSecondary }, task.completed && styles.taskTitleCompleted]}>
                                    {task.title}
                                </Text>
                                <Text style={[styles.taskTime, { color: colors.accentText }]}>{task.time} · {task.duration} мин · {task.category}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.checkbox, { borderColor: colors.border }, task.completed && styles.checkboxDone]}
                                onPress={() => toggleTaskComplete(task.id)}
                            >
                                {task.completed && <Text style={styles.checkmark}>✓</Text>}
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))
                )}

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* Модальное окно добавления задачи */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.modalBg }]}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{editingTask ? 'Редактировать задачу' : 'Новая задача'}</Text>

                        <TextInput
                            style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                            placeholder="Какая задача?"
                            placeholderTextColor={colors.textPlaceholder}
                            value={newTitle}
                            onChangeText={setNewTitle}
                        />

                        {/* Выбор даты */}
                        <Text style={[styles.modalSubLabel, { color: colors.textMuted }]}>Когда выполнять?</Text>
                        <View style={[styles.datePickerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <TouchableOpacity style={styles.datePickerBtn} onPress={() => {
                                let d = newDateDay - 1;
                                let m = newDateMonth;
                                let y = newDateYear;
                                if (d < 1) { m--; if (m < 0) { m = 11; y--; } d = getDaysInMonth(y, m); }
                                setNewDateDay(d); setNewDateMonth(m); setNewDateYear(y);
                            }}>
                                <Text style={[styles.datePickerArrow, { color: colors.accentText }]}>◀</Text>
                            </TouchableOpacity>
                            <Text style={[styles.datePickerText, { color: colors.text }]}>
                                {newDateDay} {MONTHS_GEN[newDateMonth]} {newDateYear}
                            </Text>
                            <TouchableOpacity style={styles.datePickerBtn} onPress={() => {
                                let d = newDateDay + 1;
                                let m = newDateMonth;
                                let y = newDateYear;
                                const max = getDaysInMonth(y, m);
                                if (d > max) { d = 1; m++; if (m > 11) { m = 0; y++; } }
                                setNewDateDay(d); setNewDateMonth(m); setNewDateYear(y);
                            }}>
                                <Text style={[styles.datePickerArrow, { color: colors.accentText }]}>▶</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalRow}>
                            <View style={[styles.timePickerContainer, { backgroundColor: colors.inputBg, marginRight: 10 }]}>
                                <TextInput
                                    style={[styles.timePickerInput, { color: colors.text }]}
                                    placeholder="12"
                                    placeholderTextColor={colors.textPlaceholder}
                                    value={newHours}
                                    onChangeText={handleHoursChange}
                                    keyboardType="numeric"
                                    maxLength={2}
                                    textAlign="center"
                                />
                                <Text style={[styles.timePickerColon, { color: colors.text }]}>:</Text>
                                <TextInput
                                    style={[styles.timePickerInput, { color: colors.text }]}
                                    placeholder="00"
                                    placeholderTextColor={colors.textPlaceholder}
                                    value={newMinutes}
                                    onChangeText={handleMinutesChange}
                                    keyboardType="numeric"
                                    maxLength={2}
                                    textAlign="center"
                                />
                            </View>
                            <View style={[styles.durationContainer, { backgroundColor: colors.inputBg }]}>
                                <TextInput
                                    style={[styles.timePickerInput, { color: colors.text }]}
                                    placeholder="60"
                                    placeholderTextColor={colors.textPlaceholder}
                                    value={newDuration}
                                    onChangeText={setNewDuration}
                                    keyboardType="numeric"
                                    textAlign="center"
                                />
                                <Text style={[styles.durationLabel, { color: colors.textMuted }]}>мин</Text>
                            </View>
                        </View>

                        <Text style={[styles.modalSubLabel, { color: colors.textMuted }]}>Категория</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalChips}>
                            {CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.modalChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, newCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] }]}
                                    onPress={() => setNewCategory(cat)}
                                >
                                    <Text style={[styles.modalChipText, { color: colors.textMuted }, newCategory === cat && { color: '#fff' }]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={[styles.modalSubLabel, { color: colors.textMuted }]}>Степень важности</Text>
                        <View style={styles.modalRow}>
                            {PRIORITIES.map(p => (
                                <TouchableOpacity
                                    key={p.value}
                                    style={[styles.priorityBtn, { backgroundColor: colors.surfaceAlt }, newPriority === p.value && { backgroundColor: colors.accent }]}
                                    onPress={() => setNewPriority(p.value)}
                                >
                                    <Text style={[styles.priorityBtnText, { color: colors.textMuted }, newPriority === p.value && styles.priorityBtnTextActive]}>
                                        {p.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => { resetForm(); setShowAddModal(false); }}>
                                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Отмена</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: colors.accent }]} onPress={handleSaveTask}>
                                <Text style={styles.modalSaveText}>{editingTask ? 'Сохранить' : 'Создать'}</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView></View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: rw(20), marginTop: rh(16) },
    headerAddButton: { paddingHorizontal: rw(15), paddingVertical: rh(11), borderRadius: ms(18) },
    headerTitle: { fontSize: rf(28), fontWeight: "700", textAlign: "left", marginBottom: rh(6), color: "#0f172a" },
    searchContainer: { paddingHorizontal: rw(20), marginBottom: rh(20) },
    searchInput: { backgroundColor: "#f1f5f9", padding: ms(12), borderRadius: ms(12), fontSize: rf(16), color: "#0f172a" },
    filterScroll: { paddingLeft: rw(20), marginBottom: rh(20), flexDirection: "row" },
    filterChip: { minWidth: rw(64), alignItems: "center", paddingHorizontal: rw(14), paddingVertical: rh(8), borderRadius: ms(18), backgroundColor: "#f1f5f9", marginRight: rw(10), borderWidth: 1, borderColor: "#e2e8f0" },
    filterChipActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
    filterText: { color: "#64748b", fontWeight: "500", fontSize: rf(14) },
    filterCount: { fontSize: rf(16), fontWeight: '700', textAlign: 'center', marginBottom: rh(3) },
    filterTextActive: { color: "#fff" },
    calendarCard: { marginHorizontal: rw(20), backgroundColor: "#f8fafc", borderRadius: ms(24), padding: ms(18), borderWidth: 1, borderColor: "#e2e8f0" },
    monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: rh(12) },
    monthTitle: { fontSize: rf(16), fontWeight: "700", color: "#0f172a" },
    monthNavBtn: { fontSize: rf(16), color: "#6366f1", padding: ms(8) },
    daysRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: rh(6) },
    dayLabel: { color: "#94a3b8", fontSize: rf(12), fontWeight: "600", width: rw(40), textAlign: "center" },
    calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
    dateItem: { width: `${100 / 7}%`, height: rh(40), justifyContent: "center", alignItems: "center", marginVertical: 1 },
    dateText: { fontSize: rf(14), color: "#0f172a" },
    activeDate: { backgroundColor: "#6366f1", borderRadius: ms(10) },
    activeDateText: { color: "#fff", fontWeight: "700" },
    todayDate: { borderWidth: 2, borderColor: "#6366f1", borderRadius: ms(10) },
    taskDot: { width: rw(4), height: rh(4), borderRadius: 2, backgroundColor: "#6366f1", marginTop: 1 },

    tasksHeader: { paddingHorizontal: rw(20), marginTop: rh(24), marginBottom: rh(15) },
    tasksTitle: { fontSize: rf(18), fontWeight: "700", color: "#0f172a" },

    emptyState: { alignItems: "center", padding: ms(40) },
    emptyIcon: { fontSize: rf(40), marginBottom: rh(12) },
    emptyText: { fontSize: rf(16), color: "#94a3b8" },

    taskItem: { flexDirection: "row", marginHorizontal: rw(20), backgroundColor: "#fff", padding: ms(15), borderRadius: ms(20), marginBottom: rh(12), borderWidth: 1, borderColor: "#f1f5f9", alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
    categoryIndicator: { width: rw(4), height: rh(40), borderRadius: 2 },
    taskInfo: { flex: 1, marginLeft: rw(15) },
    taskTitle: { fontSize: rf(16), fontWeight: "600", color: "#1e293b" },
    taskTitleCompleted: { textDecorationLine: "line-through", color: "#94a3b8" },
    taskTime: { fontSize: rf(14), color: "#6366f1", marginTop: rh(2) },
    checkbox: { width: rw(28), height: rw(28), borderRadius: rw(14), borderWidth: 2, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center" },
    checkboxDone: { backgroundColor: "#10b981", borderColor: "#10b981" },
    checkmark: { color: "#fff", fontSize: rf(14), fontWeight: "700" },

    addButton: { backgroundColor: "#6366f1", margin: rw(20), padding: ms(16), borderRadius: ms(22), alignItems: "center" },
    addButtonText: { color: "#fff", fontSize: rf(16), fontWeight: "600" },

    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { maxHeight: "92%", backgroundColor: "#fff", borderTopLeftRadius: ms(24), borderTopRightRadius: ms(24), padding: ms(24), paddingBottom: rh(40) },
    modalTitle: { fontSize: rf(22), fontWeight: "700", color: "#0f172a", marginBottom: rh(16) },
    modalInput: { backgroundColor: "#f1f5f9", padding: ms(14), borderRadius: ms(12), fontSize: rf(16), color: "#0f172a", marginBottom: rh(12) },
    datePickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: rh(16), backgroundColor: "#f8fafc", borderRadius: ms(12), padding: ms(12), borderWidth: 1, borderColor: "#e2e8f0" },
    datePickerBtn: { padding: ms(8) },
    datePickerArrow: { fontSize: rf(16), color: "#6366f1", fontWeight: "700" },
    datePickerText: { fontSize: rf(16), fontWeight: "600", color: "#0f172a", marginHorizontal: rw(16) },
    modalRow: { flexDirection: "row", marginBottom: rh(8) },
    timePickerContainer: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: ms(12), paddingHorizontal: rw(8) },
    timePickerInput: { flex: 1, fontSize: rf(20), fontWeight: "700", paddingVertical: rh(12), textAlign: "center" },
    timePickerColon: { fontSize: rf(24), fontWeight: "700", marginHorizontal: rw(2) },
    durationContainer: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: ms(12), paddingHorizontal: rw(8) },
    durationLabel: { fontSize: rf(14), fontWeight: "600", marginRight: rw(8) },
    modalSubLabel: { fontSize: rf(14), fontWeight: "600", color: "#64748b", marginBottom: rh(8), marginTop: rh(4) },
    modalChips: { flexDirection: "row", marginBottom: rh(12) },
    modalChip: { paddingHorizontal: rw(16), paddingVertical: rh(8), borderRadius: ms(16), backgroundColor: "#f1f5f9", marginRight: rw(8), borderWidth: 1, borderColor: "#e2e8f0" },
    modalChipText: { color: "#64748b", fontWeight: "500", fontSize: rf(13) },
    priorityBtn: { flex: 1, paddingVertical: rh(10), borderRadius: ms(10), backgroundColor: "#f1f5f9", alignItems: "center", marginRight: rw(8) },
    priorityBtnActive: { backgroundColor: "#6366f1" },
    priorityBtnText: { color: "#64748b", fontWeight: "600", fontSize: rf(13) },
    priorityBtnTextActive: { color: "#fff" },
    modalButtons: { flexDirection: "row", marginTop: rh(20), gap: rw(12) },
    modalCancelBtn: { flex: 1, paddingVertical: rh(14), borderRadius: ms(12), backgroundColor: "#f1f5f9", alignItems: "center" },
    modalCancelText: { color: "#64748b", fontWeight: "600", fontSize: rf(16) },
    modalSaveBtn: { flex: 1, paddingVertical: rh(14), borderRadius: ms(12), backgroundColor: "#6366f1", alignItems: "center" },
    modalSaveText: { color: "#fff", fontWeight: "600", fontSize: rf(16) },
});

export default TasksScreen;
