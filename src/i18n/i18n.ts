// src/i18n/i18n.ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en } from './translations/en';
import { lt } from './translations/lt';

export type Language = 'en' | 'lt';
const LANGUAGE_STORAGE_KEY = '@healthy_app_language_v1';

/**
 * Initialise i18next with resources and language detection.
 * Returns a promise that resolves when i18next is ready.
 */
export async function initI18n(): Promise<void> {
  // 1️⃣ Determine device locale (language code only)
  const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
  const deviceLang: Language = deviceLocale === 'lt' ? 'lt' : 'en';
  // 2️⃣ Load persisted language preference (overrides device locale)
  let storedLang: Language | null = null;
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'lt') storedLang = saved as Language;
  } catch (e) {
    // ignore storage errors – fallback to deviceLang
  }
  const finalLang = storedLang ?? deviceLang;

  // 3️⃣ Initialise i18next
  await i18next
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        lt: { translation: lt },
      },
      lng: finalLang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
}

/** Change language and persist the selection */
export async function changeLanguage(lang: Language): Promise<void> {
  await i18next.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export default i18next;
