
import React from 'react';
import { Language } from '../types';
import { motion } from 'framer-motion';

interface LanguageToggleProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({ language, setLanguage }) => {
  const toggleLanguage = () => {
    setLanguage(language === Language.EN ? Language.FR : Language.EN);
  };

  return (
    <motion.button
      onClick={toggleLanguage}
      className="px-4 py-2 border border-blue-400 text-blue-400 rounded-md text-sm font-semibold hover:bg-blue-400 hover:text-gray-900 transition-all duration-300"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {language === Language.EN ? 'FR' : 'EN'}
    </motion.button>
  );
};

export default LanguageToggle;
