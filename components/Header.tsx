
import React from 'react';
import { motion } from 'framer-motion';
import { Language } from '../types';
import LanguageToggle from './LanguageToggle';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  content: {
    program: string;
    pricing: string;
    contact: string;
  };
}

const Header: React.FC<HeaderProps> = ({ language, setLanguage, content }) => {
  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-gray-900/50 backdrop-blur-lg"
    >
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="text-2xl font-black tracking-tighter text-white">
          <span className="text-blue-400">SNIPER</span>ZONE
        </div>
        <nav className="hidden md:flex items-center space-x-8 text-gray-300">
          <a href="#features" className="hover:text-white transition-colors duration-300">{content.program}</a>
          <a href="#pricing" className="hover:text-white transition-colors duration-300">{content.pricing}</a>
          <a href="#" className="hover:text-white transition-colors duration-300">{content.contact}</a>
        </nav>
        <LanguageToggle language={language} setLanguage={setLanguage} />
      </div>
    </motion.header>
  );
};

export default Header;
