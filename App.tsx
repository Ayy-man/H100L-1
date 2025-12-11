import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Elements } from '@stripe/react-stripe-js';
import { Language, ProgramType } from './types';
import { content } from './constants';
import { stripePromise } from './lib/stripe';
import { Toaster } from './components/ui/sonner';
import { ProfileProvider } from './contexts/ProfileContext';
import { ToastProvider } from './hooks/useToast';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import ProgramCards from './components/ProgramCards';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import RegistrationForm from './components/RegistrationForm';
import AdminDashboard from './components/AdminDashboard';
import NewDashboard from './components/NewDashboard';
import Login from './components/Login';
import Terms from './components/Terms';
import SchedulePage from './components/SchedulePage';
import BillingPage from './components/BillingPage';
import ProfilePage from './components/ProfilePage';

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

  // Wrap all routes with ProfileProvider for authentication and profile management
  return (
    <ToastProvider>
      <ProfileProvider>
        {renderRoute(currentPath)}
        <Toaster />
      </ProfileProvider>
    </ToastProvider>
  );

  function renderRoute(path: string) {
    if (path === '/admin') {
      return <AdminDashboard />;
    }
    if (path === '/dashboard') {
      return <NewDashboard />;
    }
    // /select-profile is deprecated - redirect to dashboard (credit system shows all children)
    if (path === '/select-profile') {
      window.location.href = '/dashboard';
      return null;
    }
    if (path === '/schedule') {
      return <SchedulePage />;
    }
    if (path === '/billing') {
      return <BillingPage />;
    }
    if (path === '/profile') {
      return <ProfilePage />;
    }
    if (path === '/login') {
      return <Login />;
    }
    if (path === '/terms') {
      return <Terms language={language} onClose={() => window.history.back()} />;
    }
    if (path === '/register') {
      // Check if add-child mode
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get('mode');

      return (
        <Elements stripe={stripePromise}>
          <RegistrationForm
            onClose={() => window.location.href = '/dashboard'}
            preSelectedProgram={selectedProgram}
            language={language}
            mode={mode === 'add-child' ? 'add-child' : 'new-parent'}
          />
        </Elements>
      );
    }

    // Home page
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
                mode="new-parent"
              />
            </Elements>
          )}
        </AnimatePresence>
      </div>
    );
  }
}

export default App;