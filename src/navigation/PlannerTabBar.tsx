import React from 'react';
import { Keyboard, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';
import { useTheme } from '../store/theme';

function NavigationIcon({ index, color }: { index: number; color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {index === 0 && <><Rect x={3} y={5} width={18} height={16} rx={4} /><Path d="M7 3v4m10-4v4M3 11h18m-13 5h3" /></>}
      {index === 1 && <><Rect x={4} y={3} width={16} height={18} rx={4} /><Path d="m8 12 2 2 6-6M8 18h8" /></>}
      {index === 2 && <><Path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 1 1 17-5Z" /><Path d="m12 6 .9 2.6L16 10l-3.1 1.4L12 14l-.9-2.6L8 10l3.1-1.4Z" /></>}
      {index === 3 && <><Path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4" /></>}
      {index === 4 && <><Path d="m10 3-.6 2-2 .9-2-.5-2 3.4L5 10v3l-1.6 1.2 2 3.4 2-.5 2 .9.6 2h4l.6-2 2-.9 2 .5 2-3.4L19 13v-3l1.6-1.2-2-3.4-2 .5-2-.9L14 3Z" /><Circle cx={12} cy={11.5} r={3} /></>}
    </Svg>
  );
}

/** The capsule floats above the scene. Only its oval surface is opaque. */
export default function PlannerTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboardVisible) return null;
  return (
    <View pointerEvents="box-none" style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10), paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12) }]}>
      <View pointerEvents="none" style={styles.fade}>
        <Svg width="100%" height="100%">
          <Defs><LinearGradient id="navigationFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#102C3A" stopOpacity={0} />
            <Stop offset="0.35" stopColor="#102C3A" stopOpacity={0.06} />
            <Stop offset="0.70" stopColor="#102C3A" stopOpacity={0.16} />
            <Stop offset="1" stopColor="#102C3A" stopOpacity={0.25} />
          </LinearGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#navigationFade)" />
        </Svg>
      </View>
      <View style={[styles.capsule, { backgroundColor: colors.tabBar, borderColor: colors.navBorder }]}>
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const options = descriptors[route.key].options;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
          const color = selected ? colors.navActive : colors.navText;
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={options.tabBarAccessibilityLabel || label}
              testID={options.tabBarTestID}
              activeOpacity={0.75}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={[styles.item, selected && { backgroundColor: colors.navActiveBg }]}
            >
              <NavigationIcon index={index} color={color} />
              <Text numberOfLines={1} style={[styles.label, { color, fontSize: width < 350 ? 9 : 10, fontWeight: selected ? '700' : '500' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 8, backgroundColor: 'transparent' },
  fade: { position: 'absolute', top: -56, bottom: 0, left: 0, right: 0 },
  capsule: { flexDirection: 'row', alignSelf: 'center', width: '100%', maxWidth: 560, padding: 6, borderRadius: 44, borderWidth: 1, elevation: 6, shadowColor: '#102C3A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12 },
  item: { flex: 1, minHeight: 58, paddingVertical: 9, borderRadius: 32, alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { textAlign: 'center' },
});
