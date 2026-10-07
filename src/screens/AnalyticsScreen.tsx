import React, { useState, useMemo } from "react";
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp, getTodayStr, getDateStr } from "../store/AppContext";
import { useNavigationSpace } from "../navigation/useNavigationSpace";
import { useTheme } from "../store/theme";
import { rw, rh, rf, ms } from "../utils/responsive";

const PERIODS = ["День", "Неделя", "Месяц", "Год"];
const PERIOD_DAYS: Record<string, number> = { "День": 1, "Неделя": 7, "Месяц": 30, "Год": 365 };

const AnalyticsScreen = () => {
    const { tasks, getCompletionRate, getCategoryStats } = useApp();
    const { colors } = useTheme();
    const navigationSpace = useNavigationSpace();
    const [activePeriod, setActivePeriod] = useState("Неделя");

    const periodDays = PERIOD_DAYS[activePeriod];

    const completionRate = useMemo(() => getCompletionRate(periodDays), [getCompletionRate, periodDays]);
    const categoryStats = useMemo(() => getCategoryStats(periodDays), [getCategoryStats, periodDays]);

    // Compute period-specific stats
    const periodStats = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (periodDays - 1));
        const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
        const todayStr = getTodayStr();
        const relevant = tasks.filter(t => t.date >= cutoffStr && t.date <= todayStr);
        const completed = relevant.filter(t => t.completed);
        const totalDuration = relevant.reduce((sum, t) => sum + t.duration, 0);
        const completedDuration = completed.reduce((sum, t) => sum + t.duration, 0);

        // Find peak productivity hour
        const hourCounts: Record<number, number> = {};
        completed.forEach(t => {
            const h = parseInt(t.time.split(':')[0]);
            hourCounts[h] = (hourCounts[h] || 0) + 1;
        });
        let peakHour = -1;
        let peakCount = 0;
        Object.entries(hourCounts).forEach(([h, count]) => {
            if (count > peakCount) { peakHour = parseInt(h); peakCount = count; }
        });

        // Find most productive day
        const dayCounts: Record<number, number> = {};
        completed.forEach(t => {
            const day = new Date(t.date).getDay();
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        });
        const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        let peakDay = '';
        let peakDayCount = 0;
        Object.entries(dayCounts).forEach(([d, count]) => {
            if (count > peakDayCount) { peakDay = dayNames[parseInt(d)]; peakDayCount = count; }
        });

        // Streak: consecutive days with completed tasks
        let streak = 0;
        for (let i = 0; i < 30; i++) {
            const dateStr = getDateStr(-i);
            const dayTasks = tasks.filter(t => t.date === dateStr);
            if (dayTasks.length > 0 && dayTasks.some(t => t.completed)) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }

        return {
            totalTasks: relevant.length,
            completedTasks: completed.length,
            totalDuration,
            completedDuration,
            peakHour,
            peakDay,
            streak,
        };
    }, [tasks, periodDays]);

    const formatDuration = (minutes: number): string => {
        if (minutes < 60) return `${minutes} мин`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
    };

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: navigationSpace + rh(24) }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Аналитика</Text>
                <Text style={{ color: colors.textMuted, fontSize: rf(14), marginBottom: rh(20) }}>Маленькие шаги. Заметный прогресс.</Text>

                {/* ПЕРЕКЛЮЧАТЕЛЬ ПЕРИОДОВ */}
                <View style={[styles.periodTabs, { backgroundColor: colors.surfaceAlt }]}>
                    {PERIODS.map((period) => (
                        <TouchableOpacity
                            key={period}
                            style={[styles.tab, activePeriod === period && [styles.activeTab, { backgroundColor: colors.card }]]}
                            onPress={() => setActivePeriod(period)}
                        >
                            <Text style={[styles.tabText, { color: colors.textMuted }, activePeriod === period && { color: colors.accentText }]}>
                                {period}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={[styles.analyticsHero, { backgroundColor: colors.accentSoft }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMuted, fontSize: rf(12), fontWeight: '600' }}>ВЫПОЛНЕНИЕ ПЛАНА</Text>
                        <Text style={{ color: colors.accentText, fontSize: rf(44), fontWeight: '700', marginTop: 8 }}>{completionRate}%</Text>
                        <Text style={{ color: colors.textMuted, fontSize: rf(13), marginTop: 5 }}>{periodStats.completedTasks} из {periodStats.totalTasks} задач</Text>
                    </View>
                    <View style={styles.heroStats}>
                        <Text style={{ color: colors.text, fontSize: rf(22), fontWeight: '700' }}>{formatDuration(periodStats.completedDuration)}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: rf(12), marginTop: 5 }}>времени в деле</Text>
                        <Text style={{ color: colors.text, fontSize: rf(22), fontWeight: '700', marginTop: 16 }}>{periodStats.streak}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: rf(12), marginTop: 5 }}>дней подряд</Text>
                    </View>
                </View>

                {/* РАСПРЕДЕЛЕНИЕ ВРЕМЕНИ */}
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Распределение по категориям</Text>
                    {categoryStats.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.textPlaceholder }]}>Нет данных для анализа</Text>
                    ) : (
                        categoryStats.map((item, index) => (
                            <View key={index} style={styles.statRow}>
                                <View style={styles.statHeader}>
                                    <View style={styles.statLabelRow}>
                                        <View style={[styles.statDot, { backgroundColor: item.color }]} />
                                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{item.label}</Text>
                                    </View>
                                    <Text style={[styles.statValue, { color: colors.textSecondary }]}>{item.value}%</Text>
                                </View>
                                <View style={[styles.barBg, { backgroundColor: colors.progressBg }]}>
                                    <View style={[styles.barFill, { width: `${item.value}%`, backgroundColor: item.color }]} />
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* ИНСАЙТЫ */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Инсайты</Text>

                    {periodStats.peakHour >= 0 && (
                        <View style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.insightIconBg, { backgroundColor: colors.insightIconBg, borderColor: colors.cardBorder }]}>
                                <Text style={{ fontSize: 20 }}>🚀</Text>
                            </View>
                            <View style={styles.insightInfo}>
                                <Text style={[styles.insightTitle, { color: colors.textMuted }]}>Пик продуктивности</Text>
                                <Text style={[styles.insightValue, { color: colors.text }]}>
                                    {periodStats.peakDay ? `${periodStats.peakDay}, ` : ''}
                                    {String(periodStats.peakHour).padStart(2, '0')}:00 - {String(periodStats.peakHour + 2).padStart(2, '0')}:00
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={[styles.insightCard, { marginTop: 12, backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.insightIconBg, { backgroundColor: colors.insightIconBg, borderColor: colors.cardBorder }]}>
                            <Text style={{ fontSize: 20 }}>🔥</Text>
                        </View>
                        <View style={styles.insightInfo}>
                            <Text style={[styles.insightTitle, { color: colors.textMuted }]}>Серия продуктивных дней</Text>
                            <Text style={[styles.insightValue, { color: colors.text }]}>{periodStats.streak} {periodStats.streak === 1 ? 'день' : periodStats.streak < 5 ? 'дня' : 'дней'} подряд</Text>
                        </View>
                    </View>

                    <View style={[styles.insightCard, { marginTop: 12, backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.insightIconBg, { backgroundColor: colors.insightIconBg, borderColor: colors.cardBorder }]}>
                            <Text style={{ fontSize: 20 }}>⏱️</Text>
                        </View>
                        <View style={styles.insightInfo}>
                            <Text style={[styles.insightTitle, { color: colors.textMuted }]}>Общее время за период</Text>
                            <Text style={[styles.insightValue, { color: colors.text }]}>{formatDuration(periodStats.totalDuration)}</Text>
                        </View>
                    </View>

                    {completionRate >= 80 && (
                        <View style={[styles.insightCard, { marginTop: 12, backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.insightIconBg, { backgroundColor: colors.insightIconBg, borderColor: colors.cardBorder }]}>
                                <Text style={{ fontSize: 20 }}>🌟</Text>
                            </View>
                            <View style={styles.insightInfo}>
                                <Text style={[styles.insightTitle, { color: colors.textMuted }]}>Отличный результат!</Text>
                                <Text style={[styles.insightValue, { color: colors.text }]}>Ваша продуктивность выше 80%</Text>
                            </View>
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    scrollContent: { padding: rw(20) },
    headerTitle: {
        fontSize: rf(26),
        fontWeight: "700",
        color: "#0f172a",
        marginBottom: rh(6),
        textAlign: 'left'
    },

    // Вкладки
    periodTabs: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#f1f5f9',
        borderRadius: ms(20),
        padding: ms(4),
        marginBottom: rh(30)
    },
    tab: {
        flex: 1,
        paddingVertical: rh(8),
        alignItems: 'center',
        borderRadius: ms(16)
    },
    activeTab: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
    tabText: { color: '#64748b', fontWeight: '500', fontSize: rf(14) },
    activeTabText: { color: '#6366f1' },

    // Секции
    analyticsHero: { flexDirection: "row", alignItems: "center", padding: ms(24), borderRadius: ms(26), marginBottom: rh(20), gap: rw(20) },
    heroStats: { paddingLeft: rw(20), borderLeftWidth: 1, borderLeftColor: "rgba(88,130,140,0.3)" },
    section: { marginBottom: rh(20), padding: ms(18), borderRadius: ms(24), borderWidth: 1 },
    sectionTitle: { fontSize: rf(18), fontWeight: '600', color: '#1e293b', marginBottom: rh(16) },

    // Главный прогресс
    mainProgressBg: {
        height: rh(50),
        backgroundColor: '#f1f5f9',
        borderRadius: ms(10),
        justifyContent: 'center',
        overflow: 'hidden'
    },
    mainProgressFill: {
        position: 'absolute',
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: ms(10)
    },
    progressPercent: {
        textAlign: 'center',
        fontWeight: '700',
        fontSize: rf(18),
        color: '#000'
    },

    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: rh(16),
        gap: rw(10),
    },
    statCard: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: ms(12),
        padding: ms(12),
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    statCardValue: { fontSize: rf(18), fontWeight: '700', color: '#0f172a' },
    statCardLabel: { fontSize: rf(12), color: '#64748b', marginTop: rh(4) },

    // Ряды статистики
    statRow: { marginBottom: rh(18) },
    statHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: rh(6), alignItems: 'center' },
    statLabelRow: { flexDirection: 'row', alignItems: 'center' },
    statDot: { width: rw(8), height: rw(8), borderRadius: rw(4), marginRight: rw(8) },
    statLabel: { color: '#64748b', fontSize: rf(14) },
    statValue: { color: '#1e293b', fontWeight: '600', fontSize: rf(14) },
    barBg: { height: rh(8), backgroundColor: '#f1f5f9', borderRadius: ms(4) },
    barFill: { height: '100%', borderRadius: ms(4) },
    emptyText: { fontSize: rf(14), color: '#94a3b8', textAlign: 'center', padding: ms(20) },

    // Карточка инсайта
    insightCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: ms(16),
        borderRadius: ms(16),
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    insightIconBg: {
        width: rw(48),
        height: rw(48),
        backgroundColor: '#fff',
        borderRadius: ms(12),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: rw(16),
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    insightInfo: { flex: 1 },
    insightTitle: { fontSize: rf(14), color: '#64748b', marginBottom: rh(2) },
    insightValue: { fontSize: rf(16), fontWeight: '600', color: '#0f172a' }
});

export default AnalyticsScreen;
