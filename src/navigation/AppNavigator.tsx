import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { useApp } from '../store/AppContext';
import { useTheme } from '../store/theme';
import PlannerTabBar from './PlannerTabBar';

// Экраны
import TodayScreen from '../screens/TodayScreen';
import TasksScreen from '../screens/TasksScreen';
import AssistantScreen from '../screens/AssistantScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator tabBar={props => <PlannerTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Сегодня" component={TodayScreen} />
      <Tab.Screen name="Задачи" component={TasksScreen} />
      <Tab.Screen name="Помощник" component={AssistantScreen} />
      <Tab.Screen name="Аналитика" component={AnalyticsScreen} />
      <Tab.Screen name="Настройки" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { onboardingCompleted, completeOnboarding, isLoading } = useApp();
  const { dark, colors } = useTheme();

  const navTheme = dark ? {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: colors.background, card: colors.tabBar, primary: colors.accent },
  } : {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: colors.background, card: colors.tabBar, primary: colors.accent },
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <NavigationContainer theme={navTheme}>
      {onboardingCompleted ? (
        <MainTabs />
      ) : (
        <OnboardingScreen onFinish={completeOnboarding} />
      )}
      </NavigationContainer>
    </>
  );
}