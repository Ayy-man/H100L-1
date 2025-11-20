import React, { useState } from 'react';
import { FormData } from '../../types';
import { calculatePrice, formatPrice } from '../../lib/stripe';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Eye, EyeOff } from 'lucide-react';
import { isValidEmail, validatePassword } from '@/lib/authService';

interface FormStep4Props {
  data: FormData;
  password: string;
  confirmPassword: string;
  onPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
  errors: {
    password?: string;
    confirmPassword?: string;
    email?: string;
  };
}

const SummaryItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 text-sm text-foreground sm:mt-0 sm:col-span-2">{value || '-'}</dd>
  </div>
);

const FormStep4: React.FC<FormStep4Props> = ({
  data,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  errors,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const pricing = calculatePrice(data);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground uppercase tracking-wider border-b border-border pb-2">
          Review & Create Account
        </h3>
        <p className="text-muted-foreground mt-2">
          Review your information and create your account. You'll complete payment from your dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registration Summary</CardTitle>
          <CardDescription>Confirm your training program details</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <SummaryItem label="Player Name" value={data.playerFullName} />
            <SummaryItem label="Date of Birth" value={data.dateOfBirth} />
            <SummaryItem label="Parent Email" value={data.parentEmail} />
            <SummaryItem label="Parent Phone" value={data.parentPhone} />
            <SummaryItem
              label="Emergency Contact"
              value={`${data.emergencyContactName} (${data.emergencyContactPhone})`}
            />
            <SummaryItem
              label="Program Type"
              value={<span className="capitalize">{data.programType}</span>}
            />

            {data.programType === 'group' && (
              <>
                <SummaryItem label="Group Frequency" value={data.groupFrequency} />
                <SummaryItem
                  label="Training Days"
                  value={
                    data.groupSelectedDays.length > 0
                      ? data.groupSelectedDays
                          .map(day => day.charAt(0).toUpperCase() + day.slice(1))
                          .join(', ')
                      : 'Not selected'
                  }
                />
                <SummaryItem
                  label="Monthly Sessions"
                  value={
                    data.groupMonthlyDates && data.groupMonthlyDates.length > 0
                      ? `${data.groupMonthlyDates.length} sessions scheduled this month`
                      : 'No sessions scheduled'
                  }
                />
              </>
            )}

            {data.programType === 'private' && (
              <>
                <SummaryItem label="Session Frequency" value={data.privateFrequency} />
                <SummaryItem
                  label="Preferred Days"
                  value={
                    data.privateSelectedDays && data.privateSelectedDays.length > 0
                      ? data.privateSelectedDays.join(', ')
                      : 'Not specified'
                  }
                />
                <SummaryItem label="Preferred Time" value={data.privateTimeSlot || 'Not specified'} />
              </>
            )}

            {data.programType === 'semi-private' && (
              <>
                <SummaryItem
                  label="Available Days"
                  value={
                    data.semiPrivateAvailability && data.semiPrivateAvailability.length > 0
                      ? data.semiPrivateAvailability.join(', ')
                      : 'Not specified'
                  }
                />
                <SummaryItem
                  label="Time Windows"
                  value={
                    data.semiPrivateTimeWindows && data.semiPrivateTimeWindows.length > 0
                      ? data.semiPrivateTimeWindows.join(', ')
                      : 'Not specified'
                  }
                />
                <SummaryItem
                  label="Matching Preference"
                  value={data.semiPrivateMatchingPreference || 'Not specified'}
                />
              </>
            )}

            <SummaryItem label="Jersey Size" value={data.jerseySize} />
            <SummaryItem label="Action Plan" value={data.actionPlan?.name || 'Not provided'} />
            <SummaryItem label="Medical Report" value={data.medicalReport?.name || 'Not provided'} />
            <SummaryItem
              label="Consents"
              value={
                <span className="flex items-center gap-2 text-green-500">
                  <Check className="h-4 w-4" />
                  Photo/Video & Policies Agreed
                </span>
              }
            />
          </dl>
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Pricing Summary
          </CardTitle>
          <CardDescription>Your monthly subscription cost</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{pricing.description}</span>
              <span className="text-2xl font-bold text-foreground">{formatPrice(pricing.amount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Billing</span>
              <span className="text-foreground">
                {pricing.interval === 'month' ? 'Billed monthly (cancel anytime)' : 'One-time payment'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Creation Section */}
      <Card className="border-[#9BD4FF]/20 bg-[#9BD4FF]/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-[#9BD4FF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Create Your Account
          </CardTitle>
          <CardDescription>
            Set up your account to access your dashboard and complete payment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Email (Pre-filled, read-only) */}
            <div className="space-y-2">
              <Label htmlFor="account-email">Email Address</Label>
              <Input
                id="account-email"
                type="email"
                value={data.parentEmail}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                This will be your login email
              </p>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="account-password">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="account-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="Create a strong password"
                  className={errors.password ? 'border-destructive' : ''}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters long
              </p>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  placeholder="Re-enter your password"
                  className={errors.confirmPassword ? 'border-destructive' : ''}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                ✅ After creating your account, you'll be redirected to your dashboard where you can complete payment and manage your registration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FormStep4;
