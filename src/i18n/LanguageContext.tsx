import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { SupportedLanguage } from '../types';
import { DICTIONARIES, LANGUAGE_LABELS } from './translations';

interface LanguageContextType {
  lang: SupportedLanguage;
  language: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  language: 'en',
  setLang: () => {},
  setLanguage: () => {},
  t: (key, defaultText) => defaultText !== undefined ? defaultText : key,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

const STORAGE_LANG_KEY = 'payback-lang';

export function getInitialLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_LANG_KEY) as SupportedLanguage;
    if (saved && LANGUAGE_LABELS[saved]) {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'en';
}

export function saveLanguagePreference(lang: SupportedLanguage) {
  try {
    localStorage.setItem(STORAGE_LANG_KEY, lang);
  } catch {
    // ignore
  }
}

export const LanguageProvider: React.FC<{
  initialLang?: SupportedLanguage;
  children: React.ReactNode;
}> = ({ initialLang, children }) => {
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => initialLang || getInitialLanguage());

  const handleSetLang = useCallback((newLang: SupportedLanguage) => {
    setCurrentLang(newLang);
    saveLanguagePreference(newLang);
  }, []);

  const t = useCallback(
    (key: string, defaultText?: string): string => {
      const dict = DICTIONARIES[currentLang];
      const translated = dict && dict[key];
      if (translated !== undefined) {
        return translated;
      }
      return defaultText !== undefined ? defaultText : key;
    },
    [currentLang]
  );

  const value = useMemo(
    () => ({
      lang: currentLang,
      language: currentLang,
      setLang: handleSetLang,
      setLanguage: handleSetLang,
      t,
    }),
    [currentLang, handleSetLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

