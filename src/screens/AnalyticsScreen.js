import React from "react";
import { StyleSheet, View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const AnalyticsScreen = () => {
    // Данные для графиков (прогресс-баров)
    const stats = [
        { label: "Работа", value: "42%", color: "#6366f1", width: 42 },
        { label: "Личное", value: "28%", color: "#8b5cf6", width: 28 },
        { label: "Обучение", value: "15%", color: "#10b981", width: 15 },
        { label: "Отдых", value: "8%", color: "#f59e0b", width: 8 },
        { label: "Другое", value: "4%", color: "#94a3b8", width: 4 },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.headerTitle}>Аналитика</Text>

                {/* ПЕРЕКЛЮЧАТЕЛЬ ПЕРИОДОВ */}
                <View style={styles.periodTabs}>
                    {["День", "Неделя", "Месяц", "Год"].map((period) => (
                        <View key={period} style={[styles.tab, period === "Неделя" && styles.activeTab]}>
                            <Text style={[styles.tabText, period === "Неделя" && styles.activeTabText]}>
                                {period}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* ОБЩАЯ ПРОДУКТИВНОСТЬ */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Общая продуктивность</Text>
                    <View style={styles.mainProgressBg}>
                        <View style={[styles.mainProgressFill, { width: '78%' }]} />
                        <Text style={styles.progressPercent}>78%</Text>
                    </View>
                </View>

                {/* РАСПРЕДЕЛЕНИЕ ВРЕМЕНИ */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Распределение времени</Text>
                    {stats.map((item, index) => (
                        <View key={index} style={styles.statRow}>
                            <View style={styles.statHeader}>
                                <Text style={styles.statLabel}>{item.label}</Text>
                                <Text style={styles.statValue}>{item.value}</Text>
                            </View>
                            <View style={styles.barBg}>
                                <View style={[styles.barFill, { width: `${item.width}%`, backgroundColor: item.color }]} />
                            </View>
                        </View>
                    ))}
                </View>

                {/* ИНСАЙТЫ */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Инсайты</Text>
                    <View style={styles.insightCard}>
                        <View style={styles.insightIconBg}>
                            <Text style={{fontSize: 20}}>🚀</Text>
                        </View>
                        <View>
                            <Text style={styles.insightTitle}>Пик продуктивности</Text>
                            <Text style={styles.insightValue}>Вт, 10:00 - 12:00</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    scrollContent: { padding: 20 },
    headerTitle: {
        fontSize: 28,
        fontWeight: "700",
        color: "#0f172a",
        marginBottom: 24,
        textAlign: 'center'
    },
    
    // Вкладки
    periodTabs: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 4,
        marginBottom: 30
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8
    },
    activeTab: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
    tabText: { color: '#64748b', fontWeight: '500' },
    activeTabText: { color: '#6366f1' },

    // Секции
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 16 },

    // Главный прогресс
    mainProgressBg: {
        height: 50,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        justifyContent: 'center',
        overflow: 'hidden'
    },
    mainProgressFill: {
        position: 'absolute',
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: 10
    },
    progressPercent: {
        textAlign: 'center',
        fontWeight: '700',
        fontSize: 18,
        color: '#000'
    },

    // Ряды статистики
    statRow: { marginBottom: 18 },
    statHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    statLabel: { color: '#64748b', fontSize: 14 },
    statValue: { color: '#1e293b', fontWeight: '600' },
    barBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4 },
    barFill: { height: '100%', borderRadius: 4 },

    // Карточка инсайта
    insightCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    insightIconBg: {
        width: 48,
        height: 48,
        backgroundColor: '#fff',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    insightTitle: { fontSize: 14, color: '#64748b', marginBottom: 2 },
    insightValue: { fontSize: 16, fontWeight: '600', color: '#0f172a' }
});

export default AnalyticsScreen;