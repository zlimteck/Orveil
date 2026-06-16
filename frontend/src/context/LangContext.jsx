import React, { createContext, useContext, useState } from 'react';
import fr from '../i18n/fr';
import en from '../i18n/en';

const locales = { fr, en };
const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('nh_lang') || 'fr');

  function switchLang(l) {
    setLang(l);
    localStorage.setItem('nh_lang', l);
  }

  function t(path) {
    return path.split('.').reduce((obj, k) => obj?.[k], locales[lang]) ?? path;
  }

  return (
    <LangContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
