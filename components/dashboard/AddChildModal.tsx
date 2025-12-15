import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Loader2, Calendar, User, Phone, Heart, Shield, ChevronLeft, ChevronRight, FileUp, X, FileText } from 'lucide-react';
import { uploadMedicalFiles, validateFile } from '@/lib/storageService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';

interface AddChildModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Player categories based on age (must match types.ts PlayerCategory)
const PLAYER_CATEGORIES = [
  { value: 'M7', label: 'M7 (Under 7)', minAge: 0, maxAge: 6 },
  { value: 'M9', label: 'M9 (Under 9)', minAge: 7, maxAge: 8 },
  { value: 'M11', label: 'M11 (Under 11)', minAge: 9, maxAge: 10 },
  { value: 'M13', label: 'M13 (Under 13)', minAge: 11, maxAge: 12 },
  { value: 'M13 Elite', label: 'M13 Elite', minAge: 11, maxAge: 12 },
  { value: 'M15', label: 'M15 (Under 15)', minAge: 13, maxAge: 14 },
  { value: 'M15 Elite', label: 'M15 Elite', minAge: 13, maxAge: 14 },
  { value: 'M18', label: 'M18 (Under 18)', minAge: 15, maxAge: 17 },
  { value: 'Junior', label: 'Junior (18+)', minAge: 18, maxAge: 99 },
];

const JERSEY_SIZES = [
  'Youth S', 'Youth M', 'Youth L', 'Youth XL',
  'Adult S', 'Adult M', 'Adult L', 'Adult XL',
];

const PRIMARY_OBJECTIVES = [
  { value: 'Shooting', label: 'Shooting' },
  { value: 'Puck Handling', label: 'Puck Handling' },
  { value: 'Skating', label: 'Skating' },
  { value: 'Endurance', label: 'Endurance' },
];

// Calculate category from date of birth
const calculateCategory = (dateOfBirth: string): string => {
  if (!dateOfBirth) return '';

  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  const category = PLAYER_CATEGORIES.find(
    cat => age >= cat.minAge && age <= cat.maxAge
  );

  return category?.value || 'Junior';
};

// Form data interface
interface ChildFormData {
  // Step 1: Basic Info
  playerName: string;
  dateOfBirth: string;
  category: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyRelationship: string;

  // Step 2: Hockey & Medical Info
  position: string;
  dominantHand: string;
  currentLevel: string;
  jerseySize: string;
  primaryObjective: string;
  hasAllergies: boolean;
  allergiesDetails: string;
  hasMedicalConditions: boolean;
  medicalConditionsDetails: string;
  carriesMedication: boolean;
  medicationDetails: string;
  photoVideoConsent: boolean;
  policyAcceptance: boolean;
}

const initialFormData: ChildFormData = {
  playerName: '',
  dateOfBirth: '',
  category: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyRelationship: '',
  position: '',
  dominantHand: '',
  currentLevel: '',
  jerseySize: '',
  primaryObjective: '',
  hasAllergies: false,
  allergiesDetails: '',
  hasMedicalConditions: false,
  medicalConditionsDetails: '',
  carriesMedication: false,
  medicationDetails: '',
  photoVideoConsent: false,
  policyAcceptance: false,
};

/**
 * AddChildModal Component
 *
 * Multi-step modal for adding a child to the parent's account.
 *
 * Step 1: Basic Info + Emergency Contact
 * Step 2: Hockey Info + Medical + Consents
 *
 * After adding, the child appears in the dashboard and can be booked for sessions.
 */
const AddChildModal: React.FC<AddChildModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { user, refreshProfiles } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ChildFormData>(initialFormData);
  const [autoCategory, setAutoCategory] = useState('');

  // Medical document file state
  const [actionPlanFile, setActionPlanFile] = useState<File | null>(null);
  const [medicalReportFile, setMedicalReportFile] = useState<File | null>(null);
  const actionPlanInputRef = useRef<HTMLInputElement>(null);
  const medicalReportInputRef = useRef<HTMLInputElement>(null);

  // Auto-calculate category when DOB changes
  useEffect(() => {
    if (formData.dateOfBirth) {
      const calculated = calculateCategory(formData.dateOfBirth);
      // Update category if:
      // 1. No category selected yet, OR
      // 2. Current category matches the previous auto-detected value (user hasn't manually changed it)
      if (!formData.category || formData.category === autoCategory) {
        setFormData(prev => ({ ...prev, category: calculated }));
      }
      setAutoCategory(calculated);
    }
  }, [formData.dateOfBirth]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setAutoCategory('');
      setError('');
      setStep(1);
      setActionPlanFile(null);
      setMedicalReportFile(null);
    }
  }, [open]);

  // File input handlers
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (file: File | null) => void
  ) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }
    }
    setError('');
    setFile(file);
  };

  const removeFile = (
    setFile: (file: File | null) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleInputChange = (field: keyof ChildFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = (): boolean => {
    if (!formData.playerName.trim()) {
      setError('Please enter the player\'s name.');
      return false;
    }
    if (!formData.dateOfBirth) {
      setError('Please enter the date of birth.');
      return false;
    }
    if (!formData.category) {
      setError('Please select a category.');
      return false;
    }
    if (!formData.emergencyContactName.trim()) {
      setError('Please enter an emergency contact name.');
      return false;
    }
    if (!formData.emergencyContactPhone.trim()) {
      setError('Please enter an emergency contact phone number.');
      return false;
    }
    if (!formData.emergencyRelationship.trim()) {
      setError('Please enter the emergency contact\'s relationship to the player.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!formData.jerseySize) {
      setError('Please select a jersey size.');
      return false;
    }
    if (!formData.photoVideoConsent) {
      setError('Please consent to photo/video usage to proceed.');
      return false;
    }
    if (!formData.policyAcceptance) {
      setError('Please accept the Terms of Service and Waiver to proceed.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateStep2()) return;
    if (!user) {
      setError('You must be logged in to add a child.');
      return;
    }

    setLoading(true);

    try {
      // First, create the child to get the registration ID
      const response = await fetch('/api/add-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: user.uid,
          player_name: formData.playerName.trim(),
          date_of_birth: formData.dateOfBirth,
          player_category: formData.category,
          parent_email: user.email,
          // Emergency contact
          emergency_contact_name: formData.emergencyContactName.trim(),
          emergency_contact_phone: formData.emergencyContactPhone.trim(),
          emergency_relationship: formData.emergencyRelationship.trim(),
          // Hockey info
          position: formData.position.trim(),
          dominant_hand: formData.dominantHand,
          current_level: formData.currentLevel.trim(),
          jersey_size: formData.jerseySize,
          primary_objective: formData.primaryObjective,
          // Medical info
          has_allergies: formData.hasAllergies,
          allergies_details: formData.allergiesDetails.trim(),
          has_medical_conditions: formData.hasMedicalConditions,
          medical_conditions_details: formData.medicalConditionsDetails.trim(),
          carries_medication: formData.carriesMedication,
          medication_details: formData.medicationDetails.trim(),
          // Consents
          photo_video_consent: formData.photoVideoConsent,
          policy_acceptance: formData.policyAcceptance,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add child');
      }

      // Upload medical documents if any
      if (actionPlanFile || medicalReportFile) {
        const registrationId = data.registration?.id || data.id || `child_${user.uid}_${Date.now()}`;

        try {
          const uploadedFiles = await uploadMedicalFiles(
            {
              actionPlan: actionPlanFile,
              medicalReport: medicalReportFile,
            },
            registrationId
          );

          // Update the registration with file URLs if needed
          if (uploadedFiles.actionPlan || uploadedFiles.medicalReport) {
            await fetch('/api/add-child', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                registration_id: registrationId,
                action_plan_url: uploadedFiles.actionPlan?.url,
                medical_report_url: uploadedFiles.medicalReport?.url,
              }),
            });
          }
        } catch (uploadError: any) {
          console.warn('Medical document upload failed:', uploadError);
          // Don't fail the whole submission if upload fails
          toast.warning('Child added but medical documents failed to upload. You can add them later.');
        }
      }

      toast.success(`${formData.playerName} has been added!`);

      // Refresh the profiles list
      await refreshProfiles();

      // Call success callback if provided
      onSuccess?.();

      // Close modal
      onClose();
    } catch (err: any) {
      console.error('Add child error:', err);
      setError(err.message || 'Failed to add child. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Add a Child - Step {step} of 2
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Enter basic information and emergency contact details.'
              : 'Complete hockey information and consents.'
            }
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <>
              {/* Basic Info Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Player Information
                </h4>

                {/* Player Name */}
                <div className="space-y-2">
                  <Label htmlFor="playerName">
                    Player's Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="playerName"
                    type="text"
                    placeholder="Enter child's full name"
                    value={formData.playerName}
                    onChange={(e) => handleInputChange('playerName', e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* Date of Birth */}
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    disabled={loading}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Player Category <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleInputChange('category', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAYER_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {autoCategory && formData.category === autoCategory && (
                    <p className="text-xs text-muted-foreground">
                      Auto-detected based on date of birth
                    </p>
                  )}
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Emergency Contact
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactName">
                      Contact Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="emergencyContactName"
                      type="text"
                      placeholder="Full name"
                      value={formData.emergencyContactName}
                      onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">
                      Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyRelationship">
                    Relationship to Player <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="emergencyRelationship"
                    type="text"
                    placeholder="e.g., Grandmother, Uncle"
                    value={formData.emergencyRelationship}
                    onChange={(e) => handleInputChange('emergencyRelationship', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Next Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Hockey Info Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  Hockey Information
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      type="text"
                      placeholder="e.g., Center, Goalie"
                      value={formData.position}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dominantHand">Dominant Hand</Label>
                    <Select
                      value={formData.dominantHand}
                      onValueChange={(value) => handleInputChange('dominantHand', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select hand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Left">Left</SelectItem>
                        <SelectItem value="Right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currentLevel">Current Level</Label>
                    <Input
                      id="currentLevel"
                      type="text"
                      placeholder="e.g., AA, AAA"
                      value={formData.currentLevel}
                      onChange={(e) => handleInputChange('currentLevel', e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jerseySize">
                      Jersey Size <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.jerseySize}
                      onValueChange={(value) => handleInputChange('jerseySize', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {JERSEY_SIZES.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryObjective">Primary Training Objective</Label>
                  <Select
                    value={formData.primaryObjective}
                    onValueChange={(value) => handleInputChange('primaryObjective', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select objective" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIMARY_OBJECTIVES.map((obj) => (
                        <SelectItem key={obj.value} value={obj.value}>
                          {obj.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Medical Info Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Health & Medical
                </h4>

                {/* Allergies */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasAllergies"
                    checked={formData.hasAllergies}
                    onCheckedChange={(checked) => handleInputChange('hasAllergies', !!checked)}
                    disabled={loading}
                  />
                  <Label htmlFor="hasAllergies" className="cursor-pointer">
                    Player has allergies
                  </Label>
                </div>
                {formData.hasAllergies && (
                  <Textarea
                    placeholder="Please describe allergies..."
                    value={formData.allergiesDetails}
                    onChange={(e) => handleInputChange('allergiesDetails', e.target.value)}
                    disabled={loading}
                    rows={2}
                  />
                )}

                {/* Medical Conditions */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasMedicalConditions"
                    checked={formData.hasMedicalConditions}
                    onCheckedChange={(checked) => handleInputChange('hasMedicalConditions', !!checked)}
                    disabled={loading}
                  />
                  <Label htmlFor="hasMedicalConditions" className="cursor-pointer">
                    Player has existing medical conditions
                  </Label>
                </div>
                {formData.hasMedicalConditions && (
                  <Textarea
                    placeholder="Please describe medical conditions..."
                    value={formData.medicalConditionsDetails}
                    onChange={(e) => handleInputChange('medicalConditionsDetails', e.target.value)}
                    disabled={loading}
                    rows={2}
                  />
                )}

                {/* Medication */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="carriesMedication"
                    checked={formData.carriesMedication}
                    onCheckedChange={(checked) => handleInputChange('carriesMedication', !!checked)}
                    disabled={loading}
                  />
                  <Label htmlFor="carriesMedication" className="cursor-pointer">
                    Player carries medication (EpiPen, inhaler, etc.)
                  </Label>
                </div>
                {formData.carriesMedication && (
                  <Textarea
                    placeholder="Please specify medication details..."
                    value={formData.medicationDetails}
                    onChange={(e) => handleInputChange('medicationDetails', e.target.value)}
                    disabled={loading}
                    rows={2}
                  />
                )}

                {/* Medical Document Uploads */}
                <div className="space-y-4 pt-4 border-t border-border/50">
                  <h5 className="text-sm font-medium flex items-center gap-2">
                    <FileUp className="h-4 w-4" />
                    Medical Documents (Optional)
                  </h5>
                  <p className="text-xs text-muted-foreground">
                    Upload medical documents such as action plans or medical reports. PDF files only, max 5MB each.
                  </p>

                  {/* Action Plan Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="actionPlan">Action Plan</Label>
                    {actionPlanFile ? (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm flex-1 truncate">{actionPlanFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(setActionPlanFile, actionPlanInputRef)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        ref={actionPlanInputRef}
                        id="actionPlan"
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => handleFileChange(e, setActionPlanFile)}
                        disabled={loading}
                        className="cursor-pointer"
                      />
                    )}
                  </div>

                  {/* Medical Report Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="medicalReport">Medical Report</Label>
                    {medicalReportFile ? (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm flex-1 truncate">{medicalReportFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(setMedicalReportFile, medicalReportInputRef)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        ref={medicalReportInputRef}
                        id="medicalReport"
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => handleFileChange(e, setMedicalReportFile)}
                        disabled={loading}
                        className="cursor-pointer"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Consents Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Consents
                </h4>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="photoVideoConsent"
                    checked={formData.photoVideoConsent}
                    onCheckedChange={(checked) => handleInputChange('photoVideoConsent', !!checked)}
                    disabled={loading}
                  />
                  <Label htmlFor="photoVideoConsent" className="cursor-pointer text-sm">
                    I consent to the use of photos and videos of the player for promotional purposes.{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="policyAcceptance"
                    checked={formData.policyAcceptance}
                    onCheckedChange={(checked) => handleInputChange('policyAcceptance', !!checked)}
                    disabled={loading}
                  />
                  <Label htmlFor="policyAcceptance" className="cursor-pointer text-sm">
                    I have read and agree to the{' '}
                    <a href="/terms" className="text-primary hover:underline" target="_blank">
                      Terms of Service and Waiver
                    </a>
                    . <span className="text-destructive">*</span>
                  </Label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Child
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddChildModal;
