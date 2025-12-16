import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, User as UserIcon, Home, Calendar, CreditCard } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { logoutUser } from '@/lib/authService';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/notifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language } from '@/types';

interface DashboardLayoutProps {
  user: User;
  children: React.ReactNode;
}

/**
 * Dashboard Layout Component
 *
 * Provides the overall layout structure for the dashboard:
 * - Header with SniperZone branding
 * - User profile dropdown menu
 * - Navigation links
 * - Logout functionality
 * - Main content area
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ user, children }) => {
  const { language, setLanguage, t } = useLanguage();

  const handleLogout = async () => {
    try {
      await logoutUser();
      toast.success(t('auth.loggedOut'));
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(t('validation.logoutFailed'));
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (user.displayName) {
      return user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-8">
              <a href="/dashboard" className="flex items-center">
                <img
                  src="/images/logos/logo-actually-transparent.png"
                  alt="SniperZone Logo"
                  className="h-12 w-auto"
                />
              </a>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-1">
                <Button variant="ghost" size="sm" asChild>
                  <a href="/dashboard">
                    <Home className="mr-2 h-4 w-4" />
                    {t('nav.dashboard')}
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/schedule">
                    <Calendar className="mr-2 h-4 w-4" />
                    {t('nav.schedule')}
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/billing">
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t('nav.billing')}
                  </a>
                </Button>
              </nav>
            </div>

            {/* Language Toggle & Notifications & User Menu */}
            <div className="flex items-center space-x-4">
              {/* Language Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setLanguage(Language.FR)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    language === Language.FR
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  FR
                </button>
                <button
                  onClick={() => setLanguage(Language.EN)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    language === Language.EN
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  EN
                </button>
              </div>
              {/* Notification Bell */}
              <NotificationBell
                userId={user.uid}
                userType="parent"
              />

              <div className="hidden sm:flex flex-col items-end">
                <p className="text-sm font-medium text-foreground">
                  {user.displayName || 'Parent'}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <Avatar className="h-10 w-10 border-2 border-primary">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.displayName || 'Parent'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/profile" className="cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>{t('nav.profile')}</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/schedule" className="cursor-pointer">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>{t('nav.mySchedule')}</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/billing" className="cursor-pointer">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>{t('nav.billing')}</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('nav.logOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <nav className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" asChild>
              <a href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                {t('nav.dashboard')}
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/schedule">
                <Calendar className="mr-2 h-4 w-4" />
                {t('nav.schedule')}
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                {t('nav.billing')}
              </a>
            </Button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
            <p className="text-sm text-muted-foreground">
              {t('footer.copyright')}
            </p>
            <div className="flex items-center space-x-4">
              <a
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('nav.termsConditions')}
              </a>
              <span className="text-muted-foreground">•</span>
              <a
                href="mailto:support@sniperzone.com"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('common.contactSupport')}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
