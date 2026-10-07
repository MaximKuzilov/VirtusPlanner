// ============================================================
// YandexGPT Configuration
// Получить ключи: https://console.yandex.cloud
// 1. Создай сервисный аккаунт с ролью ai.languageModels.user
// 2. Создай API-ключ для аккаунта
// 3. Скопируй Folder ID из настроек каталога
// ============================================================

export const AI_CONFIG = {
  YANDEX_API_KEY: '__VIRTUS_LOCAL_YANDEX_API_KEY__',

  YANDEX_FOLDER_ID: '__VIRTUS_LOCAL_YANDEX_FOLDER_ID__',

  // Модель: yandexgpt (умнее) или yandexgpt-lite (быстрее)
  MODEL: 'yandexgpt',

  // Температура (0 = точно, 1 = творчески)
  TEMPERATURE: 0.3,

  // Максимальное количество токенов в ответе
  MAX_TOKENS: 2000,
} as const;

export const isAIConfigured = (): boolean => {
  return (
    !AI_CONFIG.YANDEX_API_KEY.startsWith('ВСТАВЬ_') &&
    AI_CONFIG.YANDEX_API_KEY.length > 10
  );
};

// ============================================================
// Yandex Geocoder (Яндекс.Карты) — для геолокации
// Получить ключ: https://developer.tech.yandex.ru
// 1. Создай проект → подключи «Геокодер HTTP API»
// 2. Скопируй API-ключ (вид: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
// ============================================================
export const YANDEX_MAPS_CONFIG = {
  GEOCODER_API_KEY: '__VIRTUS_LOCAL_GEOCODER_API_KEY__',
} as const;

export const isYandexMapsConfigured = (): boolean =>
  !YANDEX_MAPS_CONFIG.GEOCODER_API_KEY.startsWith('ВСТАВЬ_') &&
  YANDEX_MAPS_CONFIG.GEOCODER_API_KEY.length > 10;
