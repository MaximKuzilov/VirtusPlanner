import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch, TextInput, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../store/AppContext";
import { useNavigationSpace } from "../navigation/useNavigationSpace";
import { useTheme } from "../store/theme";
import { rw, rh, rf, ms } from "../utils/responsive";

const SettingsScreen = () => {
    const { settings, profile, updateSettings, updateProfile, clearAllData, tasks } = useApp();
    const { colors } = useTheme();
    const navigationSpace = useNavigationSpace();
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [editName, setEditName] = useState(profile.name);
    const [editEmail, setEditEmail] = useState(profile.email);

    const handleSaveProfile = () => {
        if (!editName.trim()) {
            Alert.alert("Ошибка", "Введите имя");
            return;
        }
        updateProfile({ name: editName.trim(), email: editEmail.trim() });
        setShowEditProfile(false);
    };

    const handleLogout = () => {
        Alert.alert(
            "Выйти из аккаунта?",
            "Все данные будут удалены с устройства",
            [
                { text: "Отмена", style: "cancel" },
                {
                    text: "Выйти",
                    style: "destructive",
                    onPress: () => clearAllData()
                },
            ]
        );
    };

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: navigationSpace + rh(24) }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Настройки</Text>
                <Text style={{ color: colors.textMuted, fontSize: rf(14), marginHorizontal: rw(20), marginBottom: rh(20) }}>Планировщик в вашем ритме</Text>

                {/* Блок профиля */}
                <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.profileHeading}>
                        <View style={[styles.avatarContainer, { backgroundColor: colors.accent }]}>
                            <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.userName, { color: colors.text }]}>{profile.name}</Text>
                            <Text style={[styles.userEmail, { color: colors.textMuted }]}>{profile.email || 'Ваш личный планировщик'}</Text>
                        </View>
                        <TouchableOpacity accessibilityLabel="Редактировать профиль" onPress={() => { setEditName(profile.name); setEditEmail(profile.email); setShowEditProfile(true); }} style={{ padding: 8 }}>
                            <Text style={{ color: colors.accentText, fontSize: rf(22) }}>✎</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.profileSummary, { borderTopColor: colors.border }]}>
                        <Text style={{ color: colors.textMuted, fontSize: rf(13) }}><Text style={{ color: colors.text, fontWeight: '700' }}>{totalTasks}</Text> задач всего</Text>
                        <Text style={{ color: colors.textMuted, fontSize: rf(13) }}><Text style={{ color: colors.accentText, fontWeight: '700' }}>{completedTasks}</Text> выполнено</Text>
                    </View>
                </View>

                {/* Блок Внешний вид */}
                <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textPlaceholder }]}>Внешний вид</Text>

                    <View style={styles.settingRow}>
                        <Text style={[styles.settingText, { color: colors.textSecondary }]}>Тёмная тема</Text>
                        <Switch
                            value={settings.darkMode}
                            onValueChange={(v) => updateSettings({ darkMode: v })}
                            trackColor={{ false: colors.switchTrackOff, true: colors.accent }}
                        />
                    </View>

                </View>

                {/* Блок Уведомления */}
                <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textPlaceholder }]}>Уведомления</Text>

                    <View style={styles.settingRow}>
                        <Text style={[styles.settingText, { color: colors.textSecondary }]}>Push-уведомления</Text>
                        <Switch
                            value={settings.notifications}
                            onValueChange={(v) => updateSettings({ notifications: v })}
                            trackColor={{ false: colors.switchTrackOff, true: colors.accent }}
                        />
                    </View>

                    <View style={[styles.geoExplanation, { backgroundColor: colors.accentSoft }]}>
                        <Text style={{ color: colors.accentText, fontSize: rf(14), fontWeight: '700' }}>📍 Напоминания рядом с магазином</Text>
                        <Text style={{ color: colors.textMuted, fontSize: rf(12), lineHeight: rf(18), marginTop: 6 }}>Если на сегодня есть невыполненная покупка, Виртус проверит подходящие места в радиусе 300 м и напомнит даже при свёрнутом приложении. Нужны геолокация и включённые уведомления. Время тишины учитывается.</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />

                    <View style={styles.settingRow}>
                        <View>
                            <Text style={[styles.settingText, { color: colors.textSecondary }]}>Время тишины</Text>
                            <Text style={[styles.settingSubtext, { color: colors.textPlaceholder }]}>{settings.quietHoursStart} - {settings.quietHoursEnd}</Text>
                        </View>
                        <TouchableOpacity onPress={() => {
                            if (settings.quietHoursStart === '22:00') {
                                updateSettings({ quietHoursStart: '23:00', quietHoursEnd: '07:00' });
                            } else if (settings.quietHoursStart === '23:00') {
                                updateSettings({ quietHoursStart: '21:00', quietHoursEnd: '09:00' });
                            } else {
                                updateSettings({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
                            }
                        }}>
                            <Text style={[styles.linkText, { color: colors.accentText }]}>Изменить</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* О приложении */}
                <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.sectionLabel, { color: colors.textPlaceholder }]}>О приложении</Text>
                    <View style={styles.settingRow}>
                        <Text style={[styles.settingText, { color: colors.textSecondary }]}>Версия</Text>
                        <Text style={[styles.settingSubtext, { color: colors.textPlaceholder }]}>1.0.0</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <View style={styles.settingRow}>
                        <Text style={[styles.settingText, { color: colors.textSecondary }]}>VirtusPlanner</Text>
                        <Text style={[styles.settingSubtext, { color: colors.textPlaceholder }]}>ИИ-планировщик</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Выйти из аккаунта</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Модальное окно редактирования профиля */}
            <Modal visible={showEditProfile} animationType="slide" transparent>
                <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
                    <View style={[styles.modalContent, { backgroundColor: colors.modalBg }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Редактировать профиль</Text>

                        <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Имя</Text>
                        <TextInput
                            style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Ваше имя"
                            placeholderTextColor={colors.textPlaceholder}
                        />

                        <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Email</Text>
                        <TextInput
                            style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                            value={editEmail}
                            onChangeText={setEditEmail}
                            placeholder="email@example.com"
                            placeholderTextColor={colors.textPlaceholder}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => setShowEditProfile(false)}>
                                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Отмена</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: colors.accent }]} onPress={handleSaveProfile}>
                                <Text style={styles.modalSaveText}>Сохранить</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    scrollContent: { paddingBottom: rh(40) },
    headerTitle: { fontSize: rf(26), fontWeight: "700", textAlign: "left", marginHorizontal: rw(20), marginTop: rh(20), marginBottom: rh(6), color: "#0f172a" },

    geoExplanation: { padding: ms(14), borderRadius: ms(16), marginBottom: rh(12) },
    sectionCard: {
        marginHorizontal: rw(20),
        marginBottom: rh(24),
        padding: ms(16),
        borderRadius: ms(24),
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#f1f5f9",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    sectionLabel: { fontSize: rf(14), fontWeight: "600", color: "#94a3b8", marginBottom: rh(16), textTransform: "uppercase", letterSpacing: 1 },

    profileInfo: { alignItems: "center" },
    profileHeading: { flexDirection: "row", alignItems: "center", gap: rw(14) },
    profileSummary: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: rh(14), marginTop: rh(18) },
    avatarContainer: { width: rw(52), height: rw(52), borderRadius: rw(26), backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center", marginBottom: 0 },
    avatarText: { fontSize: rf(22), fontWeight: "700", color: "#fff" },
    userName: { fontSize: rf(20), fontWeight: "700", color: "#0f172a" },
    userEmail: { fontSize: rf(14), color: "#94a3b8", marginTop: rh(4) },
    profileStats: { flexDirection: "row", marginTop: rh(16), marginBottom: rh(4), alignItems: "center" },
    profileStat: { alignItems: "center", paddingHorizontal: rw(20) },
    profileStatValue: { fontSize: rf(18), fontWeight: "700", color: "#0f172a" },
    profileStatLabel: { fontSize: rf(12), color: "#94a3b8", marginTop: rh(2) },
    profileStatDivider: { width: 1, height: rh(30), backgroundColor: "#e2e8f0" },
    editButton: { marginTop: rh(16) },
    editButtonText: { color: "#6366f1", fontWeight: "600", fontSize: rf(14) },

    settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: rh(12) },
    settingColumn: { paddingVertical: rh(12) },
    settingText: { fontSize: rf(16), fontWeight: "600", color: "#1e293b" },
    settingSubtext: { fontSize: rf(14), color: "#94a3b8", marginTop: rh(4) },
    divider: { height: 1, backgroundColor: "#f1f5f9" },
    linkText: { color: "#6366f1", fontWeight: "600" },

    sliderMock: { flexDirection: "row", alignItems: "center", marginTop: rh(15), justifyContent: "space-between" },
    sliderTrack: { flex: 1, height: rh(6), backgroundColor: "#f1f5f9", borderRadius: ms(3), marginHorizontal: rw(15), position: "relative" },
    sliderThumb: { width: rw(20), height: rw(20), borderRadius: rw(10), backgroundColor: "#6366f1", position: "absolute", top: -rh(7) },
    sliderButtons: { flexDirection: "row", justifyContent: "space-between", position: "absolute", top: -rh(20), left: -rw(5), right: -rw(5) },
    sliderBtn: { fontSize: rf(20), color: "#6366f1", fontWeight: "700", padding: ms(5) },
    fontSizeLabel: { fontSize: rf(12), color: "#94a3b8" },

    logoutButton: { marginHorizontal: rw(20), padding: ms(16), alignItems: "center" },
    logoutText: { color: "#ef4444", fontWeight: "600", fontSize: rf(16) },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { backgroundColor: "#fff", borderTopLeftRadius: ms(24), borderTopRightRadius: ms(24), padding: ms(24), paddingBottom: rh(40) },
    modalTitle: { fontSize: rf(22), fontWeight: "700", color: "#0f172a", marginBottom: rh(20) },
    modalLabel: { fontSize: rf(14), fontWeight: "600", color: "#64748b", marginBottom: rh(8) },
    modalInput: { backgroundColor: "#f1f5f9", padding: ms(14), borderRadius: ms(12), fontSize: rf(16), color: "#0f172a", marginBottom: rh(16) },
    modalButtons: { flexDirection: "row", marginTop: rh(10), gap: rw(12) },
    modalCancelBtn: { flex: 1, paddingVertical: rh(14), borderRadius: ms(12), backgroundColor: "#f1f5f9", alignItems: "center" },
    modalCancelText: { color: "#64748b", fontWeight: "600", fontSize: rf(16) },
    modalSaveBtn: { flex: 1, paddingVertical: rh(14), borderRadius: ms(12), backgroundColor: "#6366f1", alignItems: "center" },
    modalSaveText: { color: "#fff", fontWeight: "600", fontSize: rf(16) },
});

export default SettingsScreen;