import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { loginUser, resetPassword } from '@/lib/authService';
import { toast } from 'sonner';

/**
 * Login Page Component
 *
 * Allows existing users to log in with email and password.
 * Features:
 * - Email/password login
 * - Show/hide password toggle
 * - Forgot password functionality
 * - Loading states
 * - Error handling
 * - Redirects to /dashboard after successful login
 */
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await loginUser(email, password);
      console.log('Login successful, user:', userCredential.user.email);

      toast.success('Logged in successfully!');

      // Wait a bit for Firebase auth state to propagate
      setTimeout(() => {
        console.log('Redirecting to dashboard...');
        window.location.href = '/dashboard';
      }, 500);
    } catch (err: any) {
      console.error('Login error:', err);

      // User-friendly error messages
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Failed to log in. Please try again.');
      }

      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      toast.success('Password reset email sent! Check your inbox.');
      setForgotPasswordMode(false);
      setLoading(false);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError('Failed to send password reset email. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-lg bg-primary mb-4">
            <span className="text-primary-foreground font-bold text-2xl">SZ</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground mt-1">
            Log in to access your SniperZone dashboard
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {forgotPasswordMode ? 'Reset Password' : 'Sign In'}
            </CardTitle>
            <CardDescription>
              {forgotPasswordMode
                ? 'Enter your email to receive a password reset link'
                : 'Enter your credentials to access your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form
              onSubmit={forgotPasswordMode ? handleForgotPassword : handleLogin}
              className="space-y-4"
            >
              {/* Email Input */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Input (only in login mode) */}
              {!forgotPasswordMode && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
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
                </div>
              )}

              {/* Forgot Password Link (only in login mode) */}
              {!forgotPasswordMode && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setForgotPasswordMode(true)}
                    className="text-sm text-primary hover:underline"
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

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
                    {forgotPasswordMode ? 'Sending...' : 'Signing in...'}
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    {forgotPasswordMode ? 'Send Reset Link' : 'Sign In'}
                  </>
                )}
              </Button>

              {/* Back to Login (only in forgot password mode) */}
              {forgotPasswordMode && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setError('');
                  }}
                  disabled={loading}
                >
                  Back to Sign In
                </Button>
              )}
            </form>

            {/* Register Link */}
            {!forgotPasswordMode && (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <a
                  href="/"
                  className="text-primary hover:underline font-medium"
                >
                  Register now
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Support Link */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Need help?{' '}
          <a
            href="mailto:support@sniperzone.com"
            className="text-primary hover:underline"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
