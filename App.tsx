import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Elements } from '@stripe/react-stripe-js';
import { Language, ProgramType } from './types';
import { content } from './constants';
import { stripePromise } from './lib/stripe';
import { Toaster } from './components/ui/sonner';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import ProgramCards from './components/ProgramCards';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import RegistrationForm from './components/RegistrationForm';
import AdminDashboard from './components/AdminDashboard';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Terms from './components/Terms';

function App() {
  const [language, setLanguage] = useState<Language>(Language.FR);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<{
    programType: ProgramType | '';
    frequency: '1x' | '2x' | '';
  }>({ programType: '', frequency: '' });

  const selectedContent = content[language];

  const openForm = () => setIsFormOpen(true);
  const closeForm = () => {
    setIsFormOpen(false);
    // Reset selected program when form closes
    setSelectedProgram({ programType: '', frequency: '' });
  };

  const handleProgramSelect = (programType: ProgramType, frequency: '1x' | '2x' | '') => {
    setSelectedProgram({ programType, frequency });
    setIsFormOpen(true);
  };

  // Simple routing for different pages
  const currentPath = window.location.pathname;
  if (currentPath === '/admin') {
    return (
      <>
        <AdminDashboard />
        <Toaster />
      </>
    );
  }
  if (currentPath === '/dashboard') {
    return (
      <>
        <Dashboard />
        <Toaster />
      </>
    );
  }
  if (currentPath === '/login') {
    return (
      <>
        <Login />
        <Toaster />
      </>
    );
  }
  if (currentPath === '/terms') {
    return <Terms language={language} onClose={() => window.history.back()} />;
  }

  return (
    <>
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
            <ProgramCards language={language} onProgramSelect={handleProgramSelect} />
          </main>
          <Footer content={selectedContent.footer} />
        </div>

        <AnimatePresence>
          {isFormOpen && (
            <Elements stripe={stripePromise}>
              <RegistrationForm
                onClose={closeForm}
                preSelectedProgram={selectedProgram}
                language={language}
              />
            </Elements>
          )}
        </AnimatePresence>
      </div>
      <Toaster />
    </>
  );
}

export default App;