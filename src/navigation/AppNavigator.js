import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';

// Экраны
import TodayScreen from '../screens/TodayScreen';
import TasksScreen from '../screens/TasksScreen';
import AssistantScreen from '../screens/AssistantScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Иконки
import IconToday from '../assets/icons/icon1.svg';
import IconTodayActive from '../assets/icons/icon1(v).svg';
import IconTasks from '../assets/icons/icon2.svg';
import IconTasksActive from '../assets/icons/icon2(v).svg';
import IconAssistant from '../assets/icons/icon3.svg';
import IconAssistantActive from '../assets/icons/icon3(v).svg';
import IconAnalytics from '../assets/icons/icon4.svg';
import IconAnalyticsActive from '../assets/icons/icon4(v).svg';
import IconSettings from '../assets/icons/icon5.svg';
import IconSettingsActive from '../assets/icons/icon5(v).svg';

const Tab = createBottomTabNavigator();

// Компоненты иконок
const TabIcon = ({ focused, Icon, ActiveIcon }) => {
  const IconComponent = focused ? ActiveIcon : Icon;
  return <IconComponent width={24} height={24} />;
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#F3F0F8',
            height: 70,
            borderTopWidth: 0,
            paddingBottom: 10,
          },
          tabBarActiveTintColor: '#6366F1',
          tabBarInactiveTintColor: '#94A3B8',
          tabBarLabelStyle: {
            fontSize: 12,
            marginTop: -5,
          },
        }}
      >
        <Tab.Screen
          name="Сегодня"
          component={TodayScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} Icon={IconToday} ActiveIcon={IconTodayActive} />
            ),
          }}
        />
        <Tab.Screen
          name="Задачи"
          component={TasksScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} Icon={IconTasks} ActiveIcon={IconTasksActive} />
            ),
          }}
        />
        <Tab.Screen
          name="Помощник"
          component={AssistantScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} Icon={IconAssistant} ActiveIcon={IconAssistantActive} />
            ),
          }}
        />
        <Tab.Screen
          name="Аналитика"
          component={AnalyticsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} Icon={IconAnalytics} ActiveIcon={IconAnalyticsActive} />
            ),
          }}
        />
        <Tab.Screen
          name="Настройки"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} Icon={IconSettings} ActiveIcon={IconSettingsActive} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}