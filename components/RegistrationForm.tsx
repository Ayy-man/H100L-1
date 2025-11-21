import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormData, Language, ProgramType } from '../types';
import { supabase } from '../lib/supabase';
import { uploadMedicalFiles, validateFile } from '../lib/storageService';
import { createFirebaseUser, isValidEmail, validatePassword } from '../lib/authService';
import ProgressIndicator from './form/ProgressIndicator';
import FormStep1 from './form/FormStep1';
import FormStep2 from './form/FormStep2';
import FormStep3 from './form/FormStep3';
import FormStep4 from './form/FormStep4';

interface RegistrationFormProps {
  onClose: () => void;
  preSelectedProgram?: {
    programType: ProgramType | '';
    frequency: '1x' | '2x' | '';
  };
  language?: Language;
}

const initialFormData: FormData = {
  playerFullName: '', dateOfBirth: '', playerCategory: '',
  parentFullName: '', parentEmail: '', parentPhone: '', parentCity: '', parentPostalCode: '',
  communicationLanguage: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyRelationship: '',
  programType: '', groupFrequency: '', groupDay: '', groupSelectedDays: [], groupMonthlyDates: [],
  privateFrequency: '', privateSelectedDays: [], privateTimeSlot: '', semiPrivateAvailability: [],
  semiPrivateTimeWindows: [], semiPrivateMatchingPreference: '', position: '',
  dominantHand: '', currentLevel: '', jerseySize: '', hasAllergies: false,
  allergiesDetails: '', hasMedicalConditions: false, medicalConditionsDetails: '',
  actionPlan: null, medicalReport: null, photoVideoConsent: false, policyAcceptance: false,
};

// Updated: Only 4 steps now (removed payment step)
const formSteps = [
  { id: 1, title: 'Player & Parent Info' },
  { id: 2, title: 'Program Selection' },
  { id: 3, title: 'Health & Consents' },
  { id: 4, title: 'Review & Create Account' }
];

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onClose, preSelectedProgram, language }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'password' | 'confirmPassword' | 'email', string>>>({});
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New: Password fields for account creation
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('registrationFormData');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      // Don't restore file objects
      parsedData.actionPlan = null;
      parsedData.medicalReport = null;
      setFormData(parsedData);
    }
  }, []);

  // Apply pre-selected program if provided
  useEffect(() => {
    if (preSelectedProgram && preSelectedProgram.programType) {
      setFormData(prev => ({
        ...prev,
        programType: preSelectedProgram.programType,
        groupFrequency: preSelectedProgram.programType === 'group' ? preSelectedProgram.frequency : '',
      }));
    }
  }, [preSelectedProgram]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('registrationFormData', JSON.stringify(formData));
  }, [formData]);

  const validateStep = () => {
    const newErrors: Partial<Record<keyof FormData | 'password' | 'confirmPassword' | 'email', string>> = {};

    if (currentStep === 1) {
      if (!formData.playerFullName) newErrors.playerFullName = 'Player name is required.';
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required.';
      if (!formData.playerCategory) newErrors.playerCategory = 'Player category is required.';
      if (!formData.parentFullName) newErrors.parentFullName = 'Parent name is required.';
      if (!formData.parentEmail || !isValidEmail(formData.parentEmail)) newErrors.parentEmail = 'A valid email is required.';
      if (!formData.parentPhone || !/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(formData.parentPhone)) newErrors.parentPhone = 'A valid phone number is required.';
      if (!formData.parentCity) newErrors.parentCity = 'City is required.';
      if (!formData.parentPostalCode) newErrors.parentPostalCode = 'Postal code is required.';
      if (!formData.communicationLanguage) newErrors.communicationLanguage = 'Communication language is required.';
      if (!formData.emergencyContactName) newErrors.emergencyContactName = 'Emergency contact name is required.';
      if (!formData.emergencyContactPhone) newErrors.emergencyContactPhone = 'Emergency contact phone is required.';
      if (!formData.emergencyRelationship) newErrors.emergencyRelationship = 'Emergency contact relationship is required.';
      if (formData.parentPhone === formData.emergencyContactPhone) newErrors.emergencyContactPhone = 'Emergency phone must be different from parent phone.';
    }

    if (currentStep === 2) {
      if (!formData.programType) newErrors.programType = 'Please select a program type.';
      if (formData.programType === 'group') {
        if (!formData.groupFrequency) newErrors.groupFrequency = 'Please select a frequency.';

        // Validate day selection based on frequency
        if (formData.groupFrequency === '1x' && formData.groupSelectedDays.length !== 1) {
          newErrors.groupDay = 'Please select exactly 1 day per week.';
        }
        if (formData.groupFrequency === '2x' && formData.groupSelectedDays.length !== 2) {
          newErrors.groupDay = 'Please select exactly 2 days per week.';
        }
      }
    }

    if (currentStep === 3) {
      if (!formData.jerseySize) newErrors.jerseySize = 'Please select a jersey size.';
      if (!formData.policyAcceptance) newErrors.policyAcceptance = 'You must accept the policies to continue.';
      if (!formData.photoVideoConsent) newErrors.photoVideoConsent = 'You must provide consent to continue.';

      // Validate action plan if provided
      if (formData.actionPlan) {
        const actionPlanValidation = validateFile(formData.actionPlan);
        if (!actionPlanValidation.valid) {
          newErrors.actionPlan = actionPlanValidation.error;
        }
      }

      // Validate medical report if provided
      if (formData.medicalReport) {
        const medicalReportValidation = validateFile(formData.medicalReport);
        if (!medicalReportValidation.valid) {
          newErrors.medicalReport = medicalReportValidation.error;
        }
      }
    }

    // New: Step 4 validation for account creation
    if (currentStep === 4) {
      // Validate email
      if (!formData.parentEmail || !isValidEmail(formData.parentEmail)) {
        newErrors.email = 'A valid email is required for your account.';
      }

      // Validate password
      if (!password) {
        newErrors.password = 'Password is required.';
      } else {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
          newErrors.password = passwordValidation.message;
        }
      }

      // Validate password confirmation
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password.';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) {
      setDirection(1);
      if (currentStep < formSteps.length) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const prevStep = () => {
    setDirection(-1);
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'file') {
      const { files } = e.target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: files ? files[0] : null }));
    }
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMultiSelectChange = (name: keyof FormData, option: string) => {
    setFormData(prev => {
        // Special case for groupMonthlyDates - it's passed as a JSON string
        if (name === 'groupMonthlyDates') {
          try {
            const dates = JSON.parse(option);
            return { ...prev, [name]: dates };
          } catch (e) {
            console.error('Failed to parse monthly dates:', e);
            return prev;
          }
        }

        // Normal multi-select toggle behavior
        const existing = (prev[name] as string[]) || [];
        const newValues = existing.includes(option)
            ? existing.filter(item => item !== option)
            : [...existing, option];
        return { ...prev, [name]: newValues };
    });
  };

  // New: Create account and save registration (no payment yet)
  const handleCreateAccount = async () => {
    if (!validateStep()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create Firebase user
      console.log('Creating Firebase user...');
      const userCredential = await createFirebaseUser(
        formData.parentEmail,
        password,
        formData.parentFullName
      );

      const firebaseUid = userCredential.user.uid;
      console.log('Firebase user created:', firebaseUid);

      // Step 2: Upload files to Supabase Storage if any are provided
      const tempRegistrationId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      let uploadedFiles = {};

      if (formData.actionPlan || formData.medicalReport) {
        try {
          console.log('Uploading medical files...');
          uploadedFiles = await uploadMedicalFiles(
            {
              actionPlan: formData.actionPlan,
              medicalReport: formData.medicalReport,
            },
            tempRegistrationId
          );
        } catch (uploadError: any) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }
      }

      // Step 3: Create registration in Supabase
      const dataToSubmit = { ...formData };
      delete (dataToSubmit as Partial<FormData>).actionPlan;
      delete (dataToSubmit as Partial<FormData>).medicalReport;

      // Add uploaded file URLs
      if (Object.keys(uploadedFiles).length > 0) {
        dataToSubmit.medicalFiles = uploadedFiles;
      }

      console.log('Saving registration to Supabase...');
      const { data: registrationData, error: insertError } = await supabase
        .from('registrations')
        .insert({
          form_data: dataToSubmit,
          firebase_uid: firebaseUid,
          parent_email: formData.parentEmail,
          firebase_user_created_at: new Date().toISOString(),
          payment_status: 'pending' // Payment not completed yet
        })
        .select('id')
        .single();

      if (insertError || !registrationData) {
        throw insertError || new Error('Failed to create registration');
      }

      console.log('Registration created:', registrationData.id);

      // Success! Clear form data and redirect to dashboard
      localStorage.removeItem('registrationFormData');

      alert('✅ Account Created Successfully!\n\nRedirecting to your dashboard where you can complete payment.');

      // Redirect to dashboard
      window.location.href = '/dashboard';

    } catch (error: any) {
      console.error('Account creation error:', error);

      // Handle specific Firebase errors
      if (error.message.includes('email-already-in-use')) {
        setErrors({ email: 'This email is already registered. Please login instead.' });
        alert('⚠️ This email is already registered.\n\nPlease use the login page to access your account.');
      } else {
        alert(`Account creation failed: ${error.message}\n\nPlease try again or contact support if this persists.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="relative bg-black border border-white/10 rounded-xl shadow-lg w-full max-w-3xl h-[90vh] flex flex-col"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        <div className="p-8 border-b border-white/10">
            <h2 className="text-2xl uppercase font-bold tracking-wider text-center">SniperZone Registration</h2>
            <ProgressIndicator currentStep={currentStep} steps={formSteps} />
        </div>

        <div className="p-8 overflow-y-auto flex-grow relative">
            <AnimatePresence initial={false} custom={direction}>
                <motion.div
                    key={currentStep}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: "spring", stiffness: 300, damping: 30 },
                        opacity: { duration: 0.2 }
                    }}
                    className="absolute top-8 left-8 right-8"
                >
                    {currentStep === 1 && <FormStep1 data={formData} errors={errors} handleChange={handleChange} language={language || Language.FR} />}
                    {currentStep === 2 && <FormStep2 data={formData} errors={errors} handleChange={handleChange} handleMultiSelectChange={handleMultiSelectChange} />}
                    {currentStep === 3 && <FormStep3 data={formData} errors={errors} handleChange={handleChange} />}
                    {currentStep === 4 && (
                      <FormStep4
                        data={formData}
                        password={password}
                        confirmPassword={confirmPassword}
                        onPasswordChange={setPassword}
                        onConfirmPasswordChange={setConfirmPassword}
                        errors={errors}
                      />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>

        <div className="p-8 border-t border-white/10 mt-auto flex justify-between items-center">
            <button
                onClick={prevStep}
                disabled={currentStep === 1 || isSubmitting}
                className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Back
            </button>
            {currentStep < 4 ? (
                <button onClick={nextStep} className="bg-[#9BD4FF] text-black font-bold py-2 px-6 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition">
                    Next
                </button>
            ) : (
                <button
                  onClick={handleCreateAccount}
                  disabled={isSubmitting}
                  className="bg-green-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating Account...' : 'Create Account & Continue'}
                </button>
            )}
        </div>
      </motion.div>
    </div>
  );
};

export default RegistrationForm;
