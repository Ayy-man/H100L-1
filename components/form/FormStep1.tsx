import React from 'react';
import { FormData } from '../../types';
import FormInput from './FormInput';

interface FormStep1Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FormStep1: React.FC<FormStep1Props> = ({ data, errors, handleChange }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Player Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label="Player Full Name" name="playerFullName" type="text" value={data.playerFullName} handleChange={handleChange} error={errors.playerFullName} required />
        <FormInput label="Date of Birth" name="dateOfBirth" type="date" value={data.dateOfBirth} handleChange={handleChange} error={errors.dateOfBirth} required />
      </div>

      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">Parent / Guardian Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label="Parent Email" name="parentEmail" type="email" value={data.parentEmail} placeholder="you@example.com" handleChange={handleChange} error={errors.parentEmail} required />
        <FormInput label="Parent Phone" name="parentPhone" type="tel" value={data.parentPhone} placeholder="555-555-5555" handleChange={handleChange} error={errors.parentPhone} required />
      </div>
      
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
