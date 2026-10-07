import React, { useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, FlatList, Animated, Dimensions } from "react-native";
import { useTheme } from "../store/theme";
import { rw, rh, rf, ms, WINDOW_WIDTH } from "../utils/responsive";

const { width, height } = Dimensions.get("window");

const DATA = [
    {
        id: "1",
        title: "Эффективность",
        description: "Ваши задачи под полным контролем в минималистичном интерфейсе.",
        icon: "⚡",
        color: "#6366f1",
    },
    {
        id: "2",
        title: "Виртус ИИ",
        description: "Персональный ассистент, который учится помогать именно вам.",
        icon: "🧠",
        color: "#8b5cf6",
    },
    {
        id: "3",
        title: "Результат",
        description: "Наглядная аналитика ваших достижений каждый день.",
        icon: "💎",
        color: "#10b981",
    },
];

const OnboardingScreen = ({ onFinish }: { onFinish: () => void }) => {
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef(null);
    const { colors } = useTheme();

    // Функция для отрисовки точек-индикаторов
    const Paginator = () => {
        return (
            <View style={styles.paginationContainer}>
                {DATA.map((_, i) => {
                    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                    const dotWidth = scrollX.interpolate({
                        inputRange,
                        outputRange: [10, 24, 10],
                        extrapolate: "clamp",
                    });
                    const opacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: "clamp",
                    });
                    return <Animated.View style={[styles.dot, { width: dotWidth, opacity, backgroundColor: DATA[i].color }]} key={i} />;
                })}
            </View>
        );
    };

    const renderItem = ({ item, index }: { item: typeof DATA[number]; index: number }) => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
        
        // Анимация масштаба иконки
        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0, 1, 0],
        });

        return (
            <View style={[styles.slide, { width }]}>
                <Animated.View style={[styles.iconBg, { transform: [{ scale }], backgroundColor: colors.surface }]}>
                    <Text style={styles.iconText}>{item.icon}</Text>
                </Animated.View>
                <View style={styles.textContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.description, { color: colors.textMuted }]}>{item.description}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Animated.FlatList
                ref={flatListRef}
                data={DATA}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                keyExtractor={(item) => item.id}
            />

            <View style={styles.footer}>
                <Paginator />
                <TouchableOpacity 
                    style={[styles.mainButton, { backgroundColor: colors.text }]} 
                    onPress={onFinish}
                >
                    <Text style={[styles.mainButtonText, { color: colors.background }]}>Начать</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    slide: { flex: 1, alignItems: "center", justifyContent: "center", padding: rw(20) },
    iconBg: {
        width: rw(200),
        height: rw(200),
        borderRadius: rw(100),
        backgroundColor: "#f8fafc",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: rh(50),
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    iconText: { fontSize: rf(80) },
    textContainer: { alignItems: "center" },
    title: { fontSize: rf(32), fontWeight: "800", color: "#0f172a", marginBottom: rh(15) },
    description: { fontSize: rf(16), textAlign: "center", color: "#64748b", paddingHorizontal: rw(20), lineHeight: rf(24) },

    footer: { padding: ms(30), alignItems: "center" },
    paginationContainer: { flexDirection: "row", height: rh(64), justifyContent: "center", alignItems: "center" },
    dot: { height: rh(10), borderRadius: ms(5), marginHorizontal: rw(6) },

    mainButton: {
        backgroundColor: "#0f172a",
        paddingVertical: rh(18),
        paddingHorizontal: rw(60),
        borderRadius: ms(20),
        width: "100%",
        alignItems: "center",
    },
    mainButtonText: { color: "#fff", fontSize: rf(18), fontWeight: "600" },
});

export default OnboardingScreen;
