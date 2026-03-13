import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";

const tabIcons = {
    "Today": "📅",
    "Tasks": "✅",
    "Assistant": "🤖",
    "Analytics": "📊",
    "Settings": "⚙️"
};

const MainScreen = () => {
    const [currentTab, setCurrentTab] = useState("Today");

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {currentTab === "Today" && <Text>Today Screen</Text>}
                {currentTab === "Tasks" && <Text>Tasks Screen</Text>}
                {currentTab === "Assistant" && <Text>Assistant Screen</Text>}
                {currentTab === "Analytics" && <Text>Analytics Screen</Text>}
                {currentTab === "Settings" && <Text>Settings Screen</Text>}
            </View>

            <View style={styles.tabBar}>
                {Object.keys(tabIcons).map((tab) => (
                    <TouchableOpacity 
                        key={tab}
                        style={[styles.tabItem, currentTab === tab && styles.activeTab]} 
                        onPress={() => setCurrentTab(tab)}
                    >
                        <Text style={styles.icon}>{tabIcons[tab]}</Text>
                        <Text style={[styles.label, currentTab === tab && styles.activeLabel]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabBar: { 
        flexDirection: 'row', 
        height: 70, 
        borderTopWidth: 1, 
        borderColor: '#eee',
        backgroundColor: '#fff',
        justifyContent: 'space-around',
        alignItems: 'center'
    },
    tabItem: { alignItems: 'center', justifyContent: 'center', padding: 8 },
    icon: { width: 25, height: 25, fontSize: 24 },
    label: { fontSize: 12, color: '#999', marginTop: 4 },
    activeLabel: { color: '#6366F1', fontWeight: '600' },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#6366F1' }
});

export default MainScreen;