import React from 'react';
import { FormData } from '../../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

interface FormStep3Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const FormStep3: React.FC<FormStep3Props> = ({ data, errors, handleChange }) => {
  // Helper function to handle select changes
  const handleSelectChange = (name: keyof FormData) => (value: string) => {
    const syntheticEvent = {
      target: {
        name,
        value,
      },
    } as React.ChangeEvent<HTMLSelectElement>;
    handleChange(syntheticEvent);
  };

  // Helper function to handle checkbox changes
  const handleCheckboxChange = (name: keyof FormData) => (checked: boolean) => {
    const syntheticEvent = {
      target: {
        name,
        type: 'checkbox',
        checked,
      },
    } as React.ChangeEvent<HTMLInputElement>;
    handleChange(syntheticEvent);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-foreground uppercase tracking-wider border-b border-border pb-2">
        Hockey Information
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="position">Position</Label>
          <Input
            id="position"
            name="position"
            type="text"
            value={data.position}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dominantHand">Dominant Hand</Label>
          <Select
            value={data.dominantHand}
            onValueChange={handleSelectChange('dominantHand')}
          >
            <SelectTrigger>
              <SelectValue placeholder="-- Select Hand --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Left">Left</SelectItem>
              <SelectItem value="Right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentLevel">Current Level (e.g., AA, AAA)</Label>
          <Input
            id="currentLevel"
            name="currentLevel"
            type="text"
            value={data.currentLevel}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="jerseySize">
            Jersey Size <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.jerseySize}
            onValueChange={handleSelectChange('jerseySize')}
          >
            <SelectTrigger className={errors.jerseySize ? 'border-destructive' : ''}>
              <SelectValue placeholder="-- Select Size --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Youth S">Youth S</SelectItem>
              <SelectItem value="Youth M">Youth M</SelectItem>
              <SelectItem value="Youth L">Youth L</SelectItem>
              <SelectItem value="Youth XL">Youth XL</SelectItem>
              <SelectItem value="Adult S">Adult S</SelectItem>
              <SelectItem value="Adult M">Adult M</SelectItem>
              <SelectItem value="Adult L">Adult L</SelectItem>
            </SelectContent>
          </Select>
          {errors.jerseySize && (
            <p className="text-sm text-destructive">{errors.jerseySize}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="primaryObjective">
            Primary Training Objective
          </Label>
          <Select
            value={data.primaryObjective}
            onValueChange={handleSelectChange('primaryObjective')}
          >
            <SelectTrigger>
              <SelectValue placeholder="-- Select Objective --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Shooting">Shooting</SelectItem>
              <SelectItem value="Puck Handling">Puck Handling</SelectItem>
              <SelectItem value="Skating">Skating</SelectItem>
              <SelectItem value="Endurance">Endurance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <h3 className="text-xl font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 pt-4">
        Health & Medical
      </h3>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="hasAllergies"
          checked={data.hasAllergies}
          onCheckedChange={handleCheckboxChange('hasAllergies')}
        />
        <Label htmlFor="hasAllergies" className="cursor-pointer">
          Player has allergies
        </Label>
      </div>

      {data.hasAllergies && (
        <div className="space-y-2">
          <Label htmlFor="allergiesDetails">Please provide details</Label>
          <Textarea
            id="allergiesDetails"
            name="allergiesDetails"
            value={data.allergiesDetails}
            onChange={handleChange}
            rows={3}
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="hasMedicalConditions"
          checked={data.hasMedicalConditions}
          onCheckedChange={handleCheckboxChange('hasMedicalConditions')}
        />
        <Label htmlFor="hasMedicalConditions" className="cursor-pointer">
          Player has existing medical conditions
        </Label>
      </div>

      {data.hasMedicalConditions && (
        <div className="space-y-2">
          <Label htmlFor="medicalConditionsDetails">Please provide details</Label>
          <Textarea
            id="medicalConditionsDetails"
            name="medicalConditionsDetails"
            value={data.medicalConditionsDetails}
            onChange={handleChange}
            rows={3}
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="carriesMedication"
          checked={data.carriesMedication}
          onCheckedChange={handleCheckboxChange('carriesMedication')}
        />
        <Label htmlFor="carriesMedication" className="cursor-pointer">
          Player carries medication (EpiPen, inhaler, etc.)
        </Label>
      </div>

      {data.carriesMedication && (
        <div className="space-y-2">
          <Label htmlFor="medicationDetails">Medication Details</Label>
          <Textarea
            id="medicationDetails"
            name="medicationDetails"
            value={data.medicationDetails}
            onChange={handleChange}
            placeholder="Specify medication details"
            rows={3}
          />
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="actionPlan">
            Upload Action Plan (Optional, PDF only, max 5MB)
          </Label>
          <Input
            id="actionPlan"
            name="actionPlan"
            type="file"
            onChange={handleChange}
            accept=".pdf"
            className="cursor-pointer"
          />
          {data.actionPlan && (
            <p className="text-sm text-green-500">
              Selected: {data.actionPlan.name} ({(data.actionPlan.size / 1024).toFixed(2)} KB)
            </p>
          )}
          {errors.actionPlan && (
            <p className="text-sm text-destructive">{errors.actionPlan}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="medicalReport">
            Upload Medical Report (Optional, PDF only, max 5MB)
          </Label>
          <Input
            id="medicalReport"
            name="medicalReport"
            type="file"
            onChange={handleChange}
            accept=".pdf"
            className="cursor-pointer"
          />
          {data.medicalReport && (
            <p className="text-sm text-green-500">
              Selected: {data.medicalReport.name} ({(data.medicalReport.size / 1024).toFixed(2)} KB)
            </p>
          )}
          {errors.medicalReport && (
            <p className="text-sm text-destructive">{errors.medicalReport}</p>
          )}
        </div>
      </div>

      <h3 className="text-xl font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 pt-4">
        Consents
      </h3>

      <div className="space-y-4">
        <div className="flex items-start space-x-2">
          <Checkbox
            id="photoVideoConsent"
            checked={data.photoVideoConsent}
            onCheckedChange={handleCheckboxChange('photoVideoConsent')}
            className={errors.photoVideoConsent ? 'border-destructive' : ''}
          />
          <div className="flex-1">
            <Label htmlFor="photoVideoConsent" className="cursor-pointer">
              I consent to the use of photos and videos of the player for promotional purposes.{' '}
              <span className="text-destructive">*</span>
            </Label>
            {errors.photoVideoConsent && (
              <p className="text-sm text-destructive mt-1">{errors.photoVideoConsent}</p>
            )}
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="policyAcceptance"
            checked={data.policyAcceptance}
            onCheckedChange={handleCheckboxChange('policyAcceptance')}
            className={errors.policyAcceptance ? 'border-destructive' : ''}
          />
          <div className="flex-1">
            <Label htmlFor="policyAcceptance" className="cursor-pointer">
              I have read and agree to the{' '}
              <a href="/terms" className="text-primary hover:underline">
                Terms of Service and Waiver
              </a>
              . <span className="text-destructive">*</span>
            </Label>
            {errors.policyAcceptance && (
              <p className="text-sm text-destructive mt-1">{errors.policyAcceptance}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormStep3;
