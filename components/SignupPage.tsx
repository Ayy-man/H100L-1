import React, { useState } from 'react';
import { UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { createFirebaseUser, isValidEmail, validatePassword } from '@/lib/authService';
import { toast } from 'sonner';

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
      setError('Please enter your name.');
      return;
    }

    // Validate email
    if (!email || !isValidEmail(email)) {
      setError('Please enter a valid email address.');
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
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // Create Firebase user
      await createFirebaseUser(email, password, name);

      toast.success('Account created successfully!');

      // Wait a bit for Firebase auth state to propagate
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (err: any) {
      console.error('Signup error:', err);

      // User-friendly error messages
      if (err.code === 'auth/email-already-in-use' || err.message.includes('email-already-in-use')) {
        setError('This email is already registered. Please log in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use a stronger password.');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/images/logos/logo-actually-transparent.png"
              alt="SniperZone Logo"
              className="h-20 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create Your Account</h1>
          <p className="text-muted-foreground mt-1">
            Sign up to book training sessions for your children
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Create an account to get started with SniperZone
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
                <Label htmlFor="name">Your Name</Label>
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
                <Label htmlFor="email">Email</Label>
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
                <Label htmlFor="password">Password</Label>
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
                  At least 8 characters with uppercase, lowercase, and number
                </p>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Account
                  </>
                )}
              </Button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <a
                href="/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-2">What happens next?</p>
          <ul className="space-y-1 text-xs">
            <li>1. Create your account</li>
            <li>2. Add your child's information</li>
            <li>3. Buy session credits or book directly</li>
            <li>4. Start training!</li>
          </ul>
        </div>

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

export default SignupPage;
