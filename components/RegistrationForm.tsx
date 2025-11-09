import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormData, ProgramType } from '../types';
import { supabase } from '../lib/supabase';
import { uploadMedicalReport, uploadMedicationActionPlan } from '../lib/fileUpload';
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

const formSteps = [
  { id: 1, title: 'Player & Parent Info' },
  { id: 2, title: 'Program Selection' },
  { id: 3, title: 'Health & Consents' },
  { id: 4, title: 'Review & Confirm' }
];

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onClose, preSelectedProgram }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Skip to step 2 if program is pre-selected
      setCurrentStep(2);
    }
  }, [preSelectedProgram]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('registrationFormData', JSON.stringify(formData));
  }, [formData]);
  
  const validateStep = () => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (currentStep === 1) {
      if (!formData.playerFullName) newErrors.playerFullName = 'Player name is required.';
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required.';
      if (!formData.playerCategory) newErrors.playerCategory = 'Player category is required.';
      if (!formData.parentFullName) newErrors.parentFullName = 'Parent/guardian name is required.';
      if (!formData.parentEmail || !/\S+@\S+\.\S+/.test(formData.parentEmail)) newErrors.parentEmail = 'A valid email is required.';
      if (!formData.parentPhone || !/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(formData.parentPhone)) newErrors.parentPhone = 'A valid phone number is required.';
      if (!formData.parentCity) newErrors.parentCity = 'City is required.';
      if (!formData.parentPostalCode) newErrors.parentPostalCode = 'Postal code is required.';
      if (!formData.communicationLanguage) newErrors.communicationLanguage = 'Preferred communication language is required.';
      if (!formData.emergencyContactName) newErrors.emergencyContactName = 'Emergency contact name is required.';
      if (!formData.emergencyContactPhone) newErrors.emergencyContactPhone = 'Emergency contact phone is required.';

      // Check both phone AND name to ensure emergency contact is a different person
      const samePhone = formData.emergencyContactPhone === formData.parentPhone;
      const sameName = formData.emergencyContactName.toLowerCase().trim() === formData.parentFullName.toLowerCase().trim();

      if (samePhone || sameName) {
        newErrors.emergencyContactName = 'Emergency contact must be a different person than parent/guardian';
      }
    }
    if (currentStep === 2) {
        if (!formData.programType) newErrors.programType = 'Please select a program type.';
        if (formData.programType === 'group' && !formData.groupFrequency) newErrors.groupFrequency = 'Please select a frequency.';
        if (formData.programType === 'group' && formData.groupFrequency === '1x' && !formData.groupDay) newErrors.groupDay = 'Please select a day.';
    }
    if (currentStep === 3) {
        if (!formData.jerseySize) newErrors.jerseySize = 'Please select a jersey size.';
        if (!formData.primaryObjective) newErrors.primaryObjective = 'Please select a primary objective.';
        if (!formData.policyAcceptance) newErrors.policyAcceptance = 'You must accept the policies to continue.';
        if (!formData.photoVideoConsent) newErrors.photoVideoConsent = 'You must provide consent to continue.';

        // Medication validation
        if (formData.carriesMedication) {
          if (!formData.medicationDetails) newErrors.medicationDetails = 'Please provide medication details.';
          if (!formData.medicationActionPlan) newErrors.medicationActionPlan = 'Please upload an action plan for medication.';
          if (formData.medicationActionPlan && formData.medicationActionPlan.size > 5 * 1024 * 1024) {
            newErrors.medicationActionPlan = "File size cannot exceed 5MB.";
          }
          if (formData.medicationActionPlan && formData.medicationActionPlan.type !== 'application/pdf') {
            newErrors.medicationActionPlan = "Only PDF files are allowed.";
          }
        }

        // Medical report validation (optional)
        if(formData.medicalReport && formData.medicalReport.size > 5 * 1024 * 1024) newErrors.medicalReport = "File size cannot exceed 5MB.";
        if(formData.medicalReport && formData.medicalReport.type !== 'application/pdf') newErrors.medicalReport = "Only PDF files are allowed.";
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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Create a copy of the data and remove File objects before insertion
    const dataToSubmit = { ...formData };
    delete (dataToSubmit as Partial<FormData>).medicalReport; // Can't insert File object as JSON
    delete (dataToSubmit as Partial<FormData>).medicationActionPlan; // Can't insert File object as JSON

    try {
      // Step 1: Insert registration data
      console.log('Attempting to insert:', { form_data: dataToSubmit });

      const { data: registrationData, error: insertError } = await supabase
        .from('registrations')
        .insert({ form_data: dataToSubmit })
        .select()
        .single();

      if (insertError) {
        console.error('Full insert error:', JSON.stringify(insertError, null, 2));
        console.error('Error details:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        throw insertError;
      }

      const registrationId = registrationData.id;

      // Step 2: Upload files to Supabase Storage (if any)
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

      // Step 3: Update registration with file paths (if any were uploaded)
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

      alert('Registration Submitted Successfully!');
      localStorage.removeItem('registrationFormData');
      onClose();

    } catch (error: any) {
      console.error('Supabase submission error:', error);
      alert(`Submission failed: ${error.message}`);
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
                    {currentStep === 1 && <FormStep1 data={formData} errors={errors} handleChange={handleChange} />}
                    {currentStep === 2 && <FormStep2 data={formData} errors={errors} handleChange={handleChange} handleMultiSelectChange={handleMultiSelectChange} />}
                    {currentStep === 3 && <FormStep3 data={formData} errors={errors} handleChange={handleChange} />}
                    {currentStep === 4 && <FormStep4 data={formData} />}
                </motion.div>
            </AnimatePresence>
        </div>
        
        <div className="p-8 border-t border-white/10 mt-auto flex justify-between items-center">
            <button 
                onClick={prevStep} 
                disabled={currentStep === 1}
                className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Back
            </button>
            {currentStep < formSteps.length ? (
                <button onClick={nextStep} className="bg-[#9BD4FF] text-black font-bold py-2 px-6 rounded-lg hover:shadow-[0_0_15px_#9BD4FF] transition">
                    Next
                </button>
            ) : (
                <button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting}
                  className="bg-green-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                </button>
            )}
        </div>
      </motion.div>
    </div>
  );
};

export default RegistrationForm;