import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormData, ProgramType, Language } from '../types';
import { supabase } from '../lib/supabase';
import { content } from '../constants';
import { uploadMedicalReport, uploadMedicationActionPlan } from '../lib/fileUpload';
import ProgressIndicator from './form/ProgressIndicator';
import FormStep1 from './form/FormStep1';
import FormStep2 from './form/FormStep2';
import FormStep3 from './form/FormStep3';
import FormStep4 from './form/FormStep4';
import PaymentForm from './PaymentForm';

interface RegistrationFormProps {
  onClose: () => void;
  preSelectedProgram?: {
    programType: ProgramType | '';
    frequency: '1x' | '2x' | '';
  };
  language: Language;
}

const initialFormData: FormData = {
  playerFullName: '', dateOfBirth: '', playerCategory: '', parentFullName: '', parentEmail: '',
  parentPhone: '', parentCity: '', parentPostalCode: '', communicationLanguage: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyRelationship: '',
  programType: '', groupFrequency: '', groupDay: '', sundayPractice: false, privateFrequency: '',
  privateSelectedDays: [], privateTimeSlot: '', semiPrivateAvailability: [],
  semiPrivateTimeWindows: [], semiPrivateMatchingPreference: '', position: '',
  dominantHand: '', currentLevel: '', jerseySize: '', primaryObjective: '', hasAllergies: false,
  allergiesDetails: '', hasMedicalConditions: false, medicalConditionsDetails: '',
  carriesMedication: false, medicationDetails: '', medicationActionPlan: null,
  medicalReport: null, photoVideoConsent: false, policyAcceptance: false,
};

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onClose, preSelectedProgram, language }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);

  // Get translations for current language
  const t = content[language].form;

  // Define form steps with bilingual titles
  const formSteps = [
    { id: 1, title: t.steps.step1 },
    { id: 2, title: t.steps.step2 },
    { id: 3, title: t.steps.step3 },
    { id: 4, title: t.steps.step4 },
    { id: 5, title: t.steps.step5 }
  ];

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('registrationFormData');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      // Don't restore file objects
      parsedData.medicalReport = null;
      parsedData.medicationActionPlan = null;
      setFormData(parsedData);
    }
  }, []);

  // Pre-fill program selection when coming from program cards
  useEffect(() => {
    if (preSelectedProgram && preSelectedProgram.programType) {
      setFormData(prev => ({
        ...prev,
        programType: preSelectedProgram.programType,
        groupFrequency: preSelectedProgram.programType === 'group' ? preSelectedProgram.frequency : '',
        privateFrequency: preSelectedProgram.programType === 'private' ? preSelectedProgram.frequency : '',
      }));
      // Program selection is now step 1, so stay on step 1 with pre-filled data
      setCurrentStep(1);
    }
  }, [preSelectedProgram]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('registrationFormData', JSON.stringify(formData));
  }, [formData]);
  
  const validateStep = () => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    const errors = t.errors; // Error messages in current language

    if (currentStep === 1) {
      // Step 1: Program Selection validation
      if (!formData.programType) newErrors.programType = errors.selectProgram;
      if (formData.programType === 'group' && !formData.groupFrequency) newErrors.groupFrequency = errors.selectFrequency;
      if (formData.programType === 'group' && formData.groupFrequency === '1x' && !formData.groupDay) newErrors.groupDay = errors.selectDay;
    }
    if (currentStep === 2) {
      // Step 2: Player & Parent Info validation
      if (!formData.playerFullName) newErrors.playerFullName = errors.required;
      if (!formData.dateOfBirth) newErrors.dateOfBirth = errors.required;
      if (!formData.playerCategory) newErrors.playerCategory = errors.required;
      if (!formData.parentFullName) newErrors.parentFullName = errors.required;
      if (!formData.parentEmail || !/\S+@\S+\.\S+/.test(formData.parentEmail)) newErrors.parentEmail = errors.invalidEmail;
      if (!formData.parentPhone || !/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(formData.parentPhone)) newErrors.parentPhone = errors.invalidPhone;
      if (!formData.parentCity) newErrors.parentCity = errors.required;
      if (!formData.parentPostalCode) newErrors.parentPostalCode = errors.required;
      if (!formData.communicationLanguage) newErrors.communicationLanguage = errors.required;
      if (!formData.emergencyContactName) newErrors.emergencyContactName = errors.required;
      if (!formData.emergencyContactPhone) newErrors.emergencyContactPhone = errors.required;

      // Check both phone AND name to ensure emergency contact is a different person
      const samePhone = formData.emergencyContactPhone === formData.parentPhone;
      const sameName = formData.emergencyContactName.toLowerCase().trim() === formData.parentFullName.toLowerCase().trim();

      if (samePhone || sameName) {
        newErrors.emergencyContactName = errors.emergencyPhoneSame;
      }
    }
    if (currentStep === 3) {
        if (!formData.jerseySize) newErrors.jerseySize = errors.selectJerseySize;
        if (!formData.primaryObjective) newErrors.primaryObjective = errors.required;
        if (!formData.policyAcceptance) newErrors.policyAcceptance = errors.acceptPolicies;
        if (!formData.photoVideoConsent) newErrors.photoVideoConsent = errors.provideConsent;

        // Medication validation
        if (formData.carriesMedication) {
          if (!formData.medicationDetails) newErrors.medicationDetails = errors.required;
          if (!formData.medicationActionPlan) newErrors.medicationActionPlan = errors.required;
          if (formData.medicationActionPlan && formData.medicationActionPlan.size > 5 * 1024 * 1024) {
            newErrors.medicationActionPlan = errors.fileSizeExceeded;
          }
          if (formData.medicationActionPlan && formData.medicationActionPlan.type !== 'application/pdf') {
            newErrors.medicationActionPlan = errors.invalidFileType;
          }
        }

        // Medical report validation (optional)
        if(formData.medicalReport && formData.medicalReport.size > 5 * 1024 * 1024) newErrors.medicalReport = errors.fileSizeExceeded;
        if(formData.medicalReport && formData.medicalReport.type !== 'application/pdf') newErrors.medicalReport = errors.invalidFileType;
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
        const existing = (prev[name] as string[]) || [];
        const newValues = existing.includes(option)
            ? existing.filter(item => item !== option)
            : [...existing, option];
        return { ...prev, [name]: newValues };
    });
  };

  const handlePaymentSuccess = async (paymentMethod: string) => {
    setPaymentMethodId(paymentMethod);
    setPaymentError(null);

    // Proceed to submit the registration with payment info
    await handleSubmit(paymentMethod);
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    alert(t.paymentError.replace('{error}', error));
  };

  const handleSubmit = async (paymentMethod?: string) => {
    setIsSubmitting(true);
    // Create a copy of the data and remove File objects before insertion
    const dataToSubmit = { ...formData };
    delete (dataToSubmit as Partial<FormData>).medicalReport; // Can't insert File object as JSON
    delete (dataToSubmit as Partial<FormData>).medicationActionPlan; // Can't insert File object as JSON

    try {
      // Step 1: Insert registration data first (without payment info)
      const { data: registrationData, error: insertError } = await supabase
        .from('registrations')
        .insert({
          form_data: dataToSubmit,
          payment_status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      const registrationId = registrationData.id;

      // Step 2: Process payment if payment method provided
      if (paymentMethod) {
        try {
          // Determine program type and frequency
          let programType = formData.programType as 'group' | 'private' | 'semi-private';
          let frequency: '1x' | '2x' | 'one-time' = '1x';

          if (programType === 'group') {
            frequency = formData.groupFrequency as '1x' | '2x';
          } else if (programType === 'private') {
            frequency = formData.privateFrequency as '1x' | '2x' | 'one-time';
          }

          const response = await fetch('/api/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentMethodId: paymentMethod,
              registrationId: registrationId,
              customerEmail: formData.parentEmail,
              customerName: formData.playerFullName,
              programType: programType,
              frequency: frequency,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create subscription');
          }

          const subscriptionData = await response.json();
          console.log('Payment successful:', subscriptionData);

        } catch (paymentError: any) {
          console.error('Payment error:', paymentError);
          // Even if payment fails, registration is created
          // User will need to complete payment separately
          alert(t.paymentFailedButRegistered.replace('{error}', paymentError.message));
        }
      }

      // Step 3: Upload files to Supabase Storage (if any)
      const fileUploads: { [key: string]: string | null } = {};

      if (formData.medicalReport) {
        const medicalReportPath = await uploadMedicalReport(formData.medicalReport, registrationId);
        if (medicalReportPath) {
          fileUploads.medical_report_path = medicalReportPath;
        }
      }

      if (formData.medicationActionPlan) {
        const actionPlanPath = await uploadMedicationActionPlan(formData.medicationActionPlan, registrationId);
        if (actionPlanPath) {
          fileUploads.medication_action_plan_path = actionPlanPath;
        }
      }

      // Step 4: Update registration with file paths (if any were uploaded)
      if (Object.keys(fileUploads).length > 0) {
        const { error: updateError } = await supabase
          .from('registrations')
          .update(fileUploads)
          .eq('id', registrationId);

        if (updateError) {
          console.error('Error updating file paths:', updateError);
          // Don't fail the whole registration if file path update fails
        }
      }

      alert(t.success);
      localStorage.removeItem('registrationFormData');
      onClose();

    } catch (error: any) {
      console.error('Supabase submission error:', error);
      alert(t.submissionError.replace('{error}', error.message));
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
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">&times;</button>
        <div className="p-8 border-b border-white/10">
            <h2 className="text-2xl uppercase font-bold tracking-wider text-center">{t.title}</h2>
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
                    {currentStep === 1 && <FormStep2 data={formData} errors={errors} handleChange={handleChange} handleMultiSelectChange={handleMultiSelectChange} language={language} />}
                    {currentStep === 2 && <FormStep1 data={formData} errors={errors} handleChange={handleChange} language={language} />}
                    {currentStep === 3 && <FormStep3 data={formData} errors={errors} handleChange={handleChange} language={language} />}
                    {currentStep === 4 && <FormStep4 data={formData} language={language} />}
                    {currentStep === 5 && (
                      <PaymentForm
                        formData={formData}
                        onPaymentSuccess={handlePaymentSuccess}
                        onPaymentError={handlePaymentError}
                      />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
        
        {currentStep !== 5 && (
          <div className="p-8 border-t border-white/10 mt-auto flex justify-between items-center">
              <button
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {t.buttons.back}
              </button>
              {currentStep < 4 ? (
                  <button onClick={nextStep} className="bg-[#9BD4FF] text-black font-bold py-2 px-6 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition">
                      {t.buttons.next}
                  </button>
              ) : currentStep === 4 ? (
                  <button
                    onClick={nextStep}
                    className="bg-[#9BD4FF] text-black font-bold py-2 px-6 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition"
                  >
                      {t.buttons.proceedToPayment}
                  </button>
              ) : null}
          </div>
        )}
        {currentStep === 5 && (
          <div className="p-8 border-t border-white/10 mt-auto flex justify-between items-center">
              <button
                  onClick={prevStep}
                  className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition"
              >
                  {t.buttons.back}
              </button>
              {paymentError && (
                <p className="text-red-400 text-sm">{paymentError}</p>
              )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default RegistrationForm;