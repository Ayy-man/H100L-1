import React from 'react';
import { FormData } from '../../types';
import FormInput from './FormInput';
import FormSelect from './FormSelect';

interface FormStep1Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const FormStep1: React.FC<FormStep1Props> = ({ data, errors, handleChange }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Player Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label="Player Full Name" name="playerFullName" type="text" value={data.playerFullName} handleChange={handleChange} error={errors.playerFullName} required />
        <FormInput label="Date of Birth" name="dateOfBirth" type="date" value={data.dateOfBirth} handleChange={handleChange} error={errors.dateOfBirth} required />
      </div>

      <FormSelect
        label="Player Category"
        name="playerCategory"
        value={data.playerCategory}
        handleChange={handleChange}
        error={errors.playerCategory}
        required
      >
        <option value="">-- Select Category --</option>
        <option value="M9">M9 (Under 9)</option>
        <option value="M11">M11 (Under 11)</option>
        <option value="M13">M13 (Under 13)</option>
        <option value="M15">M15 (Under 15)</option>
        <option value="M18">M18 (Under 18)</option>
        <option value="Junior">Junior</option>
      </FormSelect>

      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">Parent / Guardian Information</h3>
      <FormInput label="Parent/Guardian Full Name" name="parentFullName" type="text" value={data.parentFullName} handleChange={handleChange} error={errors.parentFullName} required />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label="Parent Email" name="parentEmail" type="email" value={data.parentEmail} placeholder="you@example.com" handleChange={handleChange} error={errors.parentEmail} required />
        <FormInput label="Parent Phone" name="parentPhone" type="tel" value={data.parentPhone} placeholder="555-555-5555" handleChange={handleChange} error={errors.parentPhone} required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label="City" name="parentCity" type="text" value={data.parentCity} handleChange={handleChange} error={errors.parentCity} required />
        <FormInput label="Postal Code" name="parentPostalCode" type="text" value={data.parentPostalCode} placeholder="A1A 1A1" handleChange={handleChange} error={errors.parentPostalCode} required />
      </div>

      <FormSelect
        label="Preferred Communication Language"
        name="communicationLanguage"
        value={data.communicationLanguage}
        handleChange={handleChange}
        error={errors.communicationLanguage}
        required
      >
        <option value="">-- Select Language --</option>
        <option value="French">Français</option>
        <option value="English">English</option>
      </FormSelect>
      
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">Emergency Contact</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormInput label="Contact Full Name" name="emergencyContactName" type="text" value={data.emergencyContactName} handleChange={handleChange} error={errors.emergencyContactName} required />
        <FormInput label="Contact Phone" name="emergencyContactPhone" type="tel" value={data.emergencyContactPhone} placeholder="555-555-5555" handleChange={handleChange} error={errors.emergencyContactPhone} required />
        <FormInput label="Relationship to Player" name="emergencyRelationship" type="text" value={data.emergencyRelationship} handleChange={handleChange} error={errors.emergencyRelationship} required />
      </div>
    </div>
  );
};

export default FormStep1;
