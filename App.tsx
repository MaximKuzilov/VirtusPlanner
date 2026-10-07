import React, { useEffect } from "react";
import { AppProvider } from "./src/store/AppContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { configureNotifications, requestAndroidNotificationPermission } from "./src/services/NotificationService";

export default function App() {
    useEffect(() => {
        // Must request POST_NOTIFICATIONS at runtime on Android 13+ (API 33+)
        // before configuring push notifications, otherwise no notifications appear.
        configureNotifications();
        requestAndroidNotificationPermission().catch(() => {});
    }, []);

    return (
        <AppProvider>
            <AppNavigator />
        </AppProvider>
    );
}
