import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from './types';
import { content } from './constants';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import RegistrationForm from './components/RegistrationForm';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [language, setLanguage] = useState<Language>(Language.FR);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const selectedContent = content[language];
  
  const openForm = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);

  // Simple routing for the admin dashboard
  const currentPath = window.location.pathname;
  if (currentPath === '/admin') {
    return <AdminDashboard />;
  }

  return (
    <div className="bg-gray-900 min-h-screen overflow-x-hidden">
      <div className={isFormOpen ? 'filter blur-sm' : ''}>
        <Header
          language={language}
          setLanguage={setLanguage}
          content={selectedContent.nav}
        />
        <main>
          <Hero content={selectedContent.hero} onRegisterClick={openForm} />
          <Features content={selectedContent.features} />
          <Pricing content={selectedContent.pricing} onRegisterClick={openForm} />
        </main>
        <Footer content={selectedContent.footer} />
      </div>
      
      <AnimatePresence>
        {isFormOpen && <RegistrationForm onClose={closeForm} />}
      </AnimatePresence>
    </div>
  );
}

export default App;