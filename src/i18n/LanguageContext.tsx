import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, TranslationSchema } from './types';
import { lt } from './translations/lt';
import { en } from './translations/en';

const LANGUAGE_STORAGE_KEY = '@healthy_app_language_v1';
const DEFAULT_LANGUAGE: Language = 'lt'; // Default to Lithuanian as requested

const TRANSLATIONS: Record<Language, TranslationSchema> = {
  lt,
  en,
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  translations: TranslationSchema;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSavedLanguage() {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === 'en' || saved === 'lt') {
          setLanguageState(saved);
        } else {
          setLanguageState(DEFAULT_LANGUAGE);
        }
      } catch (e) {
        setLanguageState(DEFAULT_LANGUAGE);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSavedLanguage();
  }, []);

  const setLanguage = useCallback(async (newLang: Language) => {
    setLanguageState(newLang);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch (e) {
      console.error('Failed to save language preference:', e);
    }
  }, []);

  const currentTranslations = useMemo(() => {
    return TRANSLATIONS[language] || TRANSLATIONS[DEFAULT_LANGUAGE];
  }, [language]);

  /**
   * Helper function to retrieve nested translation keys with optional interpolation.
   * Example: t('common.save') or t('biomarkers.countInfo', { current: 5, total: 100 })
   */
  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const keys = path.split('.');
      let current: any = currentTranslations;

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback to default language dictionary if key missing
          let fallback: any = TRANSLATIONS[DEFAULT_LANGUAGE];
          for (const fk of keys) {
            if (fallback && typeof fallback === 'object' && fk in fallback) {
              fallback = fallback[fk];
            } else {
              fallback = undefined;
              break;
            }
          }
          current = fallback !== undefined ? fallback : path;
          break;
        }
      }

      if (typeof current !== 'string') {
        return path;
      }

      let result = current;
      if (params) {
        for (const [pKey, pVal] of Object.entries(params)) {
          result = result.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        }
      }

      return result;
    },
    [currentTranslations]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      translations: currentTranslations,
      t,
    }),
    [language, setLanguage, currentTranslations, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
