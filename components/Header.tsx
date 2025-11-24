
import React from 'react';
import { motion } from 'framer-motion';
import { LogIn } from 'lucide-react';
import { Language } from '../types';
import LanguageToggle from './LanguageToggle';
import { Button } from './ui/button';

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
        <a href="/" className="flex items-center">
          <img
            src="/images/logos/sniperzone-logo-white.jpg"
            alt="SniperZone Logo"
            className="h-12 w-auto"
          />
        </a>
        <nav className="hidden md:flex items-center space-x-8 text-gray-300">
          <a href="#features" className="hover:text-white transition-colors duration-300">{content.program}</a>
          <a href="#pricing" className="hover:text-white transition-colors duration-300">{content.pricing}</a>
          <a href="#" className="hover:text-white transition-colors duration-300">{content.contact}</a>
        </nav>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-white border-blue-400 hover:bg-blue-400 hover:text-white transition-all"
          >
            <a href="/login" className="flex items-center">
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </a>
          </Button>
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
