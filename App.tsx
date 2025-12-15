import React, { useState } from 'react';
import { Language } from './types';
import { content } from './constants';
import { Toaster } from './components/ui/sonner';
import { ProfileProvider } from './contexts/ProfileContext';
import { ToastProvider } from './hooks/useToast';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import ProgramCards from './components/ProgramCards';
import Footer from './components/Footer';
import AdminDashboard from './components/AdminDashboard';
import NewDashboard from './components/NewDashboard';
import Login from './components/Login';
import SignupPage from './components/SignupPage';
import Terms from './components/Terms';
import SchedulePage from './components/SchedulePage';
import BillingPage from './components/BillingPage';
import ProfilePage from './components/ProfilePage';

function App() {
  const [language, setLanguage] = useState<Language>(Language.FR);
  const selectedContent = content[language];

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
    if (path === '/signup') {
      return <SignupPage />;
    }
    if (path === '/terms') {
      return <Terms language={language} onClose={() => window.history.back()} />;
    }
    // /register is deprecated - redirect to /signup
    if (path === '/register') {
      window.location.href = '/signup';
      return null;
    }

    // Home page
    return (
      <div className="bg-gray-900 min-h-screen overflow-x-hidden">
        <Header
          language={language}
          setLanguage={setLanguage}
          content={selectedContent.nav}
        />
        <main>
          <Hero content={selectedContent.hero} />
          <Features content={selectedContent.features} />
          <ProgramCards language={language} />
        </main>
        <Footer content={selectedContent.footer} />
      </div>
    );
  }
}

export default App;