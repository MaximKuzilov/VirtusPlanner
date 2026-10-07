import React, { useState, useRef, useCallback } from "react";
import {
    StyleSheet, View, Text, Image, TextInput,
    TouchableOpacity, ScrollView, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp, getTodayStr } from "../store/AppContext";
import { useNavigationSpace } from "../navigation/useNavigationSpace";
import { useTheme } from "../store/theme";
import { Task, TaskCategory } from "../store/types";
import { sendMessageToYandexGPT, AIAction, AICommandResponse } from "../services/AIService";
import { isAIConfigured } from "../config/aiConfig";
import { rw, rh, rf, ms } from "../utils/responsive";
import { answerLocationQuery, getLocationIntent } from '../services/LocationService';
import { validateTask, parseLocalTask } from '../utils/taskValidation';


interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
}

// История для передачи в YandexGPT (только последние N сообщений)
interface ConversationTurn {
    role: 'user' | 'assistant';
    text: string;
}

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 6) return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
}

const AssistantScreen = () => {
    const { tasks, getTodayTasks, addTask, updateTask, deleteTask, toggleTaskComplete, getCompletionRate, getCategoryStats, profile, settings } = useApp();
    const { colors } = useTheme();
    const navigationSpace = useNavigationSpace();
    const [inputText, setInputText] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
    const scrollViewRef = useRef<ScrollView>(null);

    const generateResponse = useCallback((text: string): string => {
        const lower = text.toLowerCase().trim();
        const todayTasks = getTodayTasks();
        const incompleteTasks = todayTasks.filter(t => !t.completed);
        const completedTasks = todayTasks.filter(t => t.completed);
        const completionRate = getCompletionRate(7);
        const now = new Date();
        const dateStr = `${now.getDate()} ${MONTHS_GEN[now.getMonth()]}`;

        if (/^(добав|создай|запланируй|новая задач)/.test(lower)) {
            const result = parseLocalTask(text);
            if (typeof result === 'string') return `Не удалось добавить задачу: ${result}`;
            addTask(result);
            return `✅ Задача добавлена!\n${result.title}\n📅 ${result.date}, ${result.time}\n📂 ${result.category}`;
        }

        // Greeting
        if (/^(привет|здравствуй|хай|хей|добр|салют|йо)/.test(lower)) {
            const name = profile.name !== 'Пользователь' ? `, ${profile.name.split(' ')[0]}` : '';
            return `${getGreeting()}${name}! 👋\n\nСегодня ${dateStr}, ${WEEKDAYS[now.getDay()]}.\n` +
                `У вас ${todayTasks.length} задач на сегодня` +
                (incompleteTasks.length > 0 ? `, из них ${incompleteTasks.length} ещё не выполнены.` : ', и все выполнены! 🎉') +
                `\n\nЧем могу помочь?`;
        }

        // Help / capabilities
        if (/что (ты )?(умеешь|можешь)|помо(щь|ги)|возможност|функци/.test(lower)) {
            return '🧠 Я — Виртус, ваш персональный ИИ-помощник. Вот что я умею:\n\n' +
                '📋 **Задачи** — покажу расписание на сегодня\n' +
                '➕ **Добавить задачу** — скажите "добавь [название]"\n' +
                '📊 **Аналитика** — расскажу о продуктивности\n' +
                '💡 **Советы** — дам рекомендации по планированию\n' +
                '🎯 **Приоритеты** — помогу расставить приоритеты\n\n' +
                'Просто напишите, чем я могу помочь!';
        }

        // Show today tasks / schedule
        if (/задач|расписан|сегодня|план|дел(а| )|что.*делать/.test(lower)) {
            if (todayTasks.length === 0) {
                return `📋 На сегодня (${dateStr}) задач нет.\n\nХотите добавить задачу? Напишите "добавь [название задачи]"`;
            }
            let response = `📋 Ваши задачи на ${dateStr}:\n\n`;
            todayTasks.forEach((t, i) => {
                const status = t.completed ? '✅' : '⬜';
                response += `${status} ${t.time} — ${t.title} (${t.category})\n`;
            });
            response += `\nВыполнено: ${completedTasks.length}/${todayTasks.length}`;
            if (incompleteTasks.length > 0) {
                response += `\n\n💡 Следующая задача: "${incompleteTasks[0].title}" в ${incompleteTasks[0].time}`;
            }
            return response;
        }

        // Stats / analytics
        if (/продуктив|статистик|аналитик|результат|как.*дела|прогресс/.test(lower)) {
            const stats = getCategoryStats();
            let response = `📊 Ваша продуктивность за неделю: ${completionRate}%\n\n`;

            if (completionRate >= 80) response += '🌟 Отличный результат! Продолжайте в том же духе!\n\n';
            else if (completionRate >= 50) response += '👍 Хороший прогресс! Есть куда расти.\n\n';
            else response += '💪 Есть над чем поработать. Давайте улучшим результат!\n\n';

            if (stats.length > 0) {
                response += 'Распределение по категориям:\n';
                stats.forEach(s => {
                    response += `• ${s.label}: ${s.value}%\n`;
                });
            }

            response += `\nВсего задач: ${tasks.length}`;
            return response;
        }

        // Motivation
        if (/мотивац|устал|лень|не хочу|скучно|надоело|тяжело/.test(lower)) {
            const tips = [
                '💪 "Путь в тысячу миль начинается с одного шага." Начните с самой маленькой задачи!',
                '🎯 Попробуйте правило 2 минут: если задача занимает менее 2 минут — сделайте её прямо сейчас!',
                '🧘 Уставать — нормально. Сделайте перерыв на 15 минут, подышите свежим воздухом и вернитесь к задачам.',
                '⚡ Разбейте большую задачу на маленькие шаги. Каждый выполненный шаг — маленькая победа!',
                '🌟 Вы уже сделали больше, чем думаете. Посмотрите на выполненные задачи — это ваш прогресс!',
            ];
            return tips[Math.floor(Math.random() * tips.length)] +
                `\n\nСегодня вы выполнили ${completedTasks.length} из ${todayTasks.length} задач. Каждая задача — шаг к цели!`;
        }

        // Priority / planning advice
        if (/приоритет|важн|срочн|как планиров|совет|рекомендац/.test(lower)) {
            let response = '🎯 Советы по эффективному планированию:\n\n';
            response += '1. **Правило Парето** — 20% дел дают 80% результата. Найдите эти 20%.\n';
            response += '2. **Метод помидора** — работайте 25 мин, отдыхайте 5 мин.\n';
            response += '3. **Утренние ритуалы** — начинайте день с самой важной задачи.\n';
            response += '4. **Буферное время** — оставляйте 20% дня на непредвиденные дела.\n';
            response += '5. **Вечерний обзор** — каждый вечер планируйте завтрашний день.\n';

            if (incompleteTasks.length > 0) {
                response += `\n💡 Сейчас ваш приоритет: "${incompleteTasks[0].title}"`;
            }
            return response;
        }

        // Time-related
        if (/время|час|сколько времени|который час/.test(lower)) {
            return `🕐 Сейчас ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` +
                (incompleteTasks.length > 0 ? `\n\nБлижайшая задача: "${incompleteTasks[0].title}" в ${incompleteTasks[0].time}` : '');
        }

        // Complete task
        if (/выполн|готово|сделал|завершил|закончил/.test(lower)) {
            if (incompleteTasks.length > 0) {
                return `📝 Чтобы отметить задачу выполненной, нажмите на неё в расписании или на вкладке "Задачи".\n\n` +
                    `Невыполненные на сегодня:\n` +
                    incompleteTasks.map((t, i) => `${i + 1}. ${t.time} — ${t.title}`).join('\n');
            }
            return '🎉 Все задачи на сегодня выполнены! Отличная работа!';
        }

        // Default
        return `Я пока не совсем понял ваш запрос. 🤔\n\nВот что я могу:\n` +
            `• Показать задачи — "Что запланировано?"\n` +
            `• Добавить задачу — "Добавь [название]"\n` +
            `• Статистика — "Моя продуктивность"\n` +
            `• Советы — "Дай совет по планированию"\n\n` +
            `Попробуйте сформулировать запрос иначе!`;
    }, [tasks, getTodayTasks, addTask, getCompletionRate, getCategoryStats, profile]);

    // Выполнение AI-команды над задачами (одной или массива)
    const executeAIAction = useCallback((actionOrList: AIAction | AIAction[]): string | null => {
        const todayKey = getTodayStr();
        const list = Array.isArray(actionOrList) ? actionOrList : [actionOrList];

        for (const action of list) {
            if (!['ADD_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'COMPLETE_TASK', 'UNCOMPLETE_TASK', 'NONE'].includes(action.type)) {
                return 'Помощник вернул неизвестную команду. Попробуйте уточнить запрос.';
            }
            if (action.type === 'ADD_TASK') {
                if (!action.newTask) return 'Помощник не указал параметры новой задачи. Уточните название и время.';
                const error = validateTask({ ...action.newTask, duration: action.newTask.duration ?? 60, completed: false });
                if (error) return `Не удалось добавить задачу: ${error}`;
                if (action.newTask.date < todayKey) return 'Не удалось добавить задачу: выбранная дата уже прошла.';
                if (tasks.some(t => t.date === action.newTask!.date && t.title.toLowerCase().trim() === action.newTask!.title.toLowerCase().trim())) {
                    return 'Задача с таким названием на эту дату уже существует.';
                }
            }
            if (['DELETE_TASK', 'COMPLETE_TASK', 'UNCOMPLETE_TASK'].includes(action.type) && !tasks.some(t => t.id === action.taskId)) {
                return 'Задача не найдена. Уточните её название.';
            }
            if (action.type === 'UPDATE_TASK') {
                const existing = tasks.find(t => t.id === action.taskId);
                if (!existing) return 'Задача для изменения не найдена. Уточните её название.';
                const error = validateTask({ ...existing, ...action.updates });
                if (error) return `Не удалось изменить задачу: ${error}`;
            }
        }
        const addedTitles = new Set<string>();

        for (const action of list) {
            switch (action.type) {
                case 'ADD_TASK': {
                    const t = action.newTask;
                    if (!t || !t.title) break;

                    const taskDate = t.date || todayKey;

                    // Пропускаем задачи на прошедшие даты
                    if (taskDate < todayKey) break;

                    // Дедупликация: не создавать если уже есть задача с таким же заголовком на ту же дату
                    const titleNorm = t.title.toLowerCase().trim();
                    const isDuplicate = tasks.some(
                        existing => existing.date === taskDate &&
                        existing.title.toLowerCase().trim() === titleNorm
                    );
                    const batchKey = `${taskDate}:${titleNorm}`;
                    if (isDuplicate || addedTitles.has(batchKey)) break;
                    addedTitles.add(batchKey);

                    addTask({
                        title: t.title,
                        category: t.category || 'Другое',
                        date: taskDate,
                        time: t.time || '09:00',
                        duration: t.duration || 60,
                        priority: t.priority || 'medium',
                        completed: false,
                    });
                    break;
                }
                case 'UPDATE_TASK':
                    if (action.taskId && action.updates) updateTask(action.taskId, action.updates);
                    break;
                case 'DELETE_TASK':
                    if (action.taskId) deleteTask(action.taskId);
                    break;
                case 'COMPLETE_TASK': {
                    const t = tasks.find(t => t.id === action.taskId);
                    if (t && !t.completed) updateTask(action.taskId!, { completed: true });
                    break;
                }
                case 'UNCOMPLETE_TASK': {
                    const t = tasks.find(t => t.id === action.taskId);
                    if (t && t.completed) updateTask(action.taskId!, { completed: false });
                    break;
                }
            }
        }
        return null; // всегда показываем сообщение AI
    }, [tasks, addTask, updateTask, deleteTask, toggleTaskComplete]);

    const sendingRef = useRef(false);
    const handleSend = useCallback(async (suggestion?: string) => {
        if (sendingRef.current) return;

        const userText = (suggestion ?? inputText).trim();
        if (!userText) return;
        sendingRef.current = true;
        setIsLoading(true);
        const userMessage: Message = {
            id: Date.now().toString(),
            text: userText,
            sender: 'user'
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText("");

        const locationIntent = getLocationIntent(userText);
        if (locationIntent) {
            try {
                const reply = await answerLocationQuery(locationIntent);
                setMessages(prev => [...prev, { id: `${Date.now()}-bot`, text: reply, sender: 'bot' }]);
                setConversationHistory(prev => [...prev.slice(-10), { role: 'user', text: userText }, { role: 'assistant', text: reply }]);
            } catch (error) {
                const detail = error instanceof Error ? error.message : 'Проверьте интернет и доступ к местоположению.';
                setMessages(prev => [...prev, { id: `${Date.now()}-error`, text: `📍 Не удалось проверить места рядом.\n${detail}`, sender: 'bot' }]);
            } finally {
                sendingRef.current = false;
                setIsLoading(false);
            }
            return;
        }

        // Запрос к YandexGPT
        if (isAIConfigured()) {
            setIsLoading(true);
            try {
                const aiResult = await sendMessageToYandexGPT(
                    userText,
                    conversationHistory.slice(-12),
                    tasks,
                    profile.name,
                    getCompletionRate(7),
                    undefined,
                    settings,
                    profile.email || undefined,
                );

                // Выполняем одно или несколько действий
                const actionsToRun = aiResult.actions ?? (aiResult.action ? [aiResult.action] : []);
                if (actionsToRun.length > 0) {
                    const validationError = executeAIAction(actionsToRun);
                    if (validationError) {
                        setMessages(prev => [...prev, {
                            id: (Date.now() + 1).toString(),
                            text: validationError,
                            sender: 'bot',
                        }]);
                        setConversationHistory(prev => [
                            ...prev.slice(-12),
                            { role: 'user', text: userText },
                            { role: 'assistant', text: validationError },
                        ]);
                        return;
                    }
                }

                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    text: aiResult.text,
                    sender: 'bot',
                }]);
                setConversationHistory(prev => [
                    ...prev.slice(-12),
                    { role: 'user', text: userText },
                    { role: 'assistant', text: aiResult.text },
                ]);
            } catch (err) {
                // Проверяем — сетевая ошибка или нет
                const errMsg = err instanceof Error ? err.message : String(err);
                const isNetworkError =
                    errMsg.toLowerCase().includes('network request failed') ||
                    errMsg.toLowerCase().includes('failed to fetch') ||
                    errMsg.toLowerCase().includes('timeout') ||
                    errMsg.toLowerCase().includes('network error');

                const fallbackText = isNetworkError
                    ? generateResponse(userText)
                    : `⚠️ Ошибка связи с AI.\n\n${generateResponse(userText)}`;

                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    text: fallbackText,
                    sender: 'bot',
                }]);
                setConversationHistory(prev => [
                    ...prev.slice(-12),
                    { role: 'user', text: userText },
                    { role: 'assistant', text: fallbackText },
                ]);
            } finally {
                sendingRef.current = false;
                setIsLoading(false);
            }
        } else {
            // AI не настроен — локальный режим
            const response = generateResponse(userText);
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    text: response,
                    sender: 'bot',
                }]);
                setConversationHistory(prev => [
                    ...prev.slice(-12),
                    { role: 'user', text: userText },
                    { role: 'assistant', text: response },
                ]);
                sendingRef.current = false;
                setIsLoading(false);
            }, 400);
        }
    }, [inputText, isLoading, conversationHistory, tasks, profile, getCompletionRate, generateResponse, executeAIAction]);

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
                {/* ЗОНА ЧАТА */}
                <View style={styles.chatArea}>
                    {messages.length === 0 ? (
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.centerContent, { paddingBottom: navigationSpace + rh(90) }]}>
                            <View style={styles.assistantHeader}>
                                <Image style={styles.bigLogo} source={require('../assets/logo.png')} resizeMode="contain" />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.welcomeTitle, { color: colors.text }]}>Виртус</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: rf(13), lineHeight: rf(19) }}>Ваш помощник в планах и делах</Text>
                                </View>
                            </View>
                            <View style={[styles.assistantIntro, { backgroundColor: colors.accentSoft }]}>
                                <Text style={{ color: colors.text, fontSize: rf(22), fontWeight: '700' }}>С чего начнём?</Text>
                                <Text style={{ color: colors.textMuted, fontSize: rf(14), lineHeight: rf(21), marginTop: rh(8) }}>Расскажите о планах или выберите действие. Помогу с задачами и найду места рядом.</Text>
                            </View>
                            <View style={styles.quickActions}>
                                {[
                                    { label: '📋 Мои задачи', text: 'Покажи мои задачи на сегодня' },
                                    { label: '📍 Магазины рядом', text: 'Покажи магазины поблизости' },
                                    { label: '📊 Продуктивность', text: 'Как моя продуктивность?' },
                                    { label: '✏️ Изменить задачу', text: 'Измени название задачи' },
                                    { label: '✅ Выполнить задачу', text: 'Отметь задачу выполненной' },
                                    { label: '🗑️ Удалить задачу', text: 'Удали задачу' },
                                    { label: '💡 Совет', text: 'Дай совет по планированию' },
                                ].map((action, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                        onPress={() => {
                                            handleSend(action.text);
                                        }}
                                    >
                                        <Text style={[styles.quickActionText, { color: colors.textMuted }]}>{action.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    ) : (
                        <ScrollView
                            ref={scrollViewRef}
                            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                            contentContainerStyle={[styles.messageList, { paddingBottom: navigationSpace + rh(90) }]}
                        >
                            {messages.map((item) => (
                                <View
                                    key={item.id}
                                    style={[
                                        styles.messageBubble,
                                        item.sender === 'user' ? [styles.userBubble, { backgroundColor: colors.accent }] : [styles.botBubble, { backgroundColor: colors.surface }]
                                    ]}
                                >
                                    <Text style={[
                                        styles.messageText,
                                        item.sender === 'user' ? styles.userText : [styles.botText, { color: colors.textSecondary }]
                                    ]}>
                                        {item.text}
                                    </Text>
                                </View>
                            ))}
                            {isLoading && (
                                <View style={[styles.messageBubble, styles.botBubble, { backgroundColor: colors.surfaceAlt }]}>
                                    <ActivityIndicator size="small" color={colors.accent} />
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>

                <View style={[styles.inputWrapper, { bottom: navigationSpace }]}>
                    <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                            style={[styles.textInput, { color: colors.textSecondary }]}
                            placeholder="Спросите Виртуса..."
                            placeholderTextColor={colors.textPlaceholder}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline={false}
                            onSubmitEditing={() => handleSend()}
                            returnKeyType="send"
                        />
                        <TouchableOpacity
                            onPress={() => handleSend()}
                            style={[styles.sendButton, { backgroundColor: isLoading ? colors.border : colors.accent }]}
                            disabled={isLoading}
                        >
                            {isLoading
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.sendIcon}>➔</Text>
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    chatArea: { flex: 1 },

    // Начальный экран
    centerContent: { flexGrow: 1, padding: ms(20), paddingBottom: rh(28) },
    assistantHeader: { flexDirection: "row", alignItems: "center", gap: rw(12), marginBottom: rh(22) },
    assistantIntro: { borderRadius: ms(24), padding: ms(22), marginBottom: rh(16) },
    bigLogo: { width: rw(48), height: rw(48) },
    welcomeTitle: { fontSize: rf(24), fontWeight: "700", color: "#0f172a", marginBottom: rh(8) },
    welcomeSub: { fontSize: rf(16), color: "#94a3b8", textAlign: 'center', marginBottom: rh(24) },

    quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: rw(10), marginTop: rh(8) },
    quickAction: {
        width: "48%", minHeight: rh(64), justifyContent: "center", paddingHorizontal: rw(12), paddingVertical: rh(14), borderRadius: ms(20),
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0'
    },
    quickActionText: { fontSize: rf(13), color: '#64748b', fontWeight: '500' },

    // Список сообщений
    messageList: { paddingHorizontal: rw(16), paddingVertical: rh(20) },
    messageBubble: {
        padding: ms(14),
        borderRadius: ms(20),
        marginBottom: rh(12),
        maxWidth: '80%',
    },
    userBubble: {
        backgroundColor: "#6366f1",
        alignSelf: 'flex-end',
        borderBottomRightRadius: ms(4),
    },
    botBubble: {
        backgroundColor: "#f1f5f9",
        alignSelf: 'flex-start',
        borderBottomLeftRadius: ms(4),
    },
    messageText: { fontSize: rf(15), lineHeight: rf(22) },
    userText: { color: "#fff" },
    botText: { color: "#1e293b" },

    // Поле ввода
    inputWrapper: {
        position: "absolute", left: 0, right: 0,
        paddingHorizontal: rw(16),
        paddingBottom: Platform.OS === 'ios' ? rh(10) : rh(20),
        paddingTop: rh(10),

    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: "#f8fafc",
        borderRadius: ms(25),
        paddingHorizontal: rw(8),
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    textInput: {
        flex: 1,
        height: rh(50),
        paddingHorizontal: rw(15),
        fontSize: rf(16),
        color: "#1e293b",
    },
    sendButton: {
        backgroundColor: "#6366f1",
        width: rw(38),
        height: rw(38),
        borderRadius: rw(19),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: rw(4),
    },
    sendIcon: { color: "#fff", fontSize: rf(18), fontWeight: "bold" },
});

export default AssistantScreen;
