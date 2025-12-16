import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from '../types';
import { translations, TranslationKey } from '../lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'sniperzone_language';

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage first, default to French
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en') return Language.EN;
    }
    return Language.FR;
  });

  // Persist language preference
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  };

  // Translation helper
  const t = (key: TranslationKey): string => {
    const keys = key.split('.');
    let result: any = translations;

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        console.warn(`Translation missing: ${key}`);
        return key;
      }
    }

    if (result && typeof result === 'object' && language in result) {
      return result[language];
    }

    console.warn(`Translation missing for language ${language}: ${key}`);
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// For components that might be outside provider (fallback)
export const useLanguageSafe = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    return {
      language: Language.FR,
      setLanguage: () => {},
      t: (key: TranslationKey) => key,
    };
  }
  return context;
};
