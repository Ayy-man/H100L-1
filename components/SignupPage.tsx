import React, { useState } from 'react';
import { UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { createFirebaseUser, isValidEmail, validatePassword } from '@/lib/authService';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language } from '@/types';

/**
 * Signup Page Component
 *
 * Simple signup form for new users.
 * Creates a Firebase account with just email and password.
 * After signup, users are redirected to the dashboard where they can add children.
 *
 * New Flow:
 * 1. Parent signs up (email + password only)
 * 2. Lands on Dashboard
 * 3. Prompted to add their first child
 * 4. Can buy credits and book sessions for any child
 */
const SignupPage: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate name
    if (!name.trim()) {
      setError(t('validation.enterName'));
      return;
    }

    // Validate email
    if (!email || !isValidEmail(email)) {
      setError(t('validation.enterValidEmail'));
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      return;
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      setError(t('validation.passwordsNoMatch'));
      return;
    }

    setLoading(true);

    try {
      // Create Firebase user
      await createFirebaseUser(email, password, name);

      toast.success(t('auth.accountCreated'));

      // Wait a bit for Firebase auth state to propagate
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (err: any) {
      console.error('Signup error:', err);

      // User-friendly error messages
      if (err.code === 'auth/email-already-in-use' || err.message.includes('email-already-in-use')) {
        setError(t('validation.emailAlreadyUsed'));
      } else if (err.code === 'auth/invalid-email') {
        setError(t('validation.invalidEmail'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('validation.weakPassword'));
      } else {
        setError(err.message || t('validation.accountCreationFailed'));
      }

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Language Toggle */}
        <div className="flex justify-end mb-4">
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
        </div>

        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/images/logos/logo-actually-transparent.png"
              alt="SniperZone Logo"
              className="h-20 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('auth.createYourAccount')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('auth.signUpDescription')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('auth.signUp')}</CardTitle>
            <CardDescription>
              {t('auth.getStarted')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              {/* Name Input */}
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.yourName')}</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('auth.passwordRequirements')}
                </p>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.creatingAccount')}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('auth.createAccount')}
                  </>
                )}
              </Button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">{t('auth.alreadyHaveAccount')} </span>
              <a
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                {t('auth.signIn')}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">{t('auth.whatHappensNext')}</p>
          <ul className="space-y-1 text-xs">
            <li>{t('auth.step1CreateAccount')}</li>
            <li>{t('auth.step2AddChild')}</li>
            <li>{t('auth.step3BuyCredits')}</li>
            <li>{t('auth.step4StartTraining')}</li>
          </ul>
        </div>

        {/* Support Link */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {t('common.needHelp')}{' '}
          <a
            href="mailto:support@sniperzone.com"
            className="text-primary hover:underline"
          >
            {t('common.contactSupport')}
          </a>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
