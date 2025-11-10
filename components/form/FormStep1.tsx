import React from 'react';
import { FormData, Language } from '../../types';
import { content } from '../../constants';
import FormInput from './FormInput';
import FormSelect from './FormSelect';

interface FormStep1Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  language: Language;
}

const FormStep1: React.FC<FormStep1Props> = ({ data, errors, handleChange, language }) => {
  const t = content[language].form.step1;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">{t.playerInfoHeader}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label={t.playerFullName.label} name="playerFullName" type="text" value={data.playerFullName} placeholder={t.playerFullName.placeholder} handleChange={handleChange} error={errors.playerFullName} required />
        <FormInput label={t.dateOfBirth.label} name="dateOfBirth" type="date" value={data.dateOfBirth} placeholder={t.dateOfBirth.placeholder} handleChange={handleChange} error={errors.dateOfBirth} required />
      </div>

      <FormSelect
        label={t.playerCategory.label}
        name="playerCategory"
        value={data.playerCategory}
        handleChange={handleChange}
        error={errors.playerCategory}
        required
      >
        <option value="">{t.playerCategory.placeholder}</option>
        <option value="M9">M9 (Under 9)</option>
        <option value="M11">M11 (Under 11)</option>
        <option value="M13">M13 (Under 13)</option>
        <option value="M15">M15 (Under 15)</option>
        <option value="M18">M18 (Under 18)</option>
        <option value="Junior">Junior</option>
      </FormSelect>

      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">{t.parentInfoHeader}</h3>
      <FormInput label={t.parentFullName.label} name="parentFullName" type="text" value={data.parentFullName} placeholder={t.parentFullName.placeholder} handleChange={handleChange} error={errors.parentFullName} required />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label={t.parentEmail.label} name="parentEmail" type="email" value={data.parentEmail} placeholder={t.parentEmail.placeholder} handleChange={handleChange} error={errors.parentEmail} required />
        <FormInput label={t.parentPhone.label} name="parentPhone" type="tel" value={data.parentPhone} placeholder={t.parentPhone.placeholder} handleChange={handleChange} error={errors.parentPhone} required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormInput label={t.parentCity.label} name="parentCity" type="text" value={data.parentCity} placeholder={t.parentCity.placeholder} handleChange={handleChange} error={errors.parentCity} required />
        <FormInput label={t.parentPostalCode.label} name="parentPostalCode" type="text" value={data.parentPostalCode} placeholder={t.parentPostalCode.placeholder} handleChange={handleChange} error={errors.parentPostalCode} required />
      </div>

      <FormSelect
        label={t.communicationLanguage.label}
        name="communicationLanguage"
        value={data.communicationLanguage}
        handleChange={handleChange}
        error={errors.communicationLanguage}
        required
      >
        <option value="">{t.communicationLanguage.placeholder}</option>
        <option value="French">Français</option>
        <option value="English">English</option>
      </FormSelect>

      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">{t.emergencyContactHeader}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FormInput label={t.emergencyContactName.label} name="emergencyContactName" type="text" value={data.emergencyContactName} placeholder={t.emergencyContactName.placeholder} handleChange={handleChange} error={errors.emergencyContactName} required />
        <FormInput label={t.emergencyContactPhone.label} name="emergencyContactPhone" type="tel" value={data.emergencyContactPhone} placeholder={t.emergencyContactPhone.placeholder} handleChange={handleChange} error={errors.emergencyContactPhone} required />
        <FormInput label={t.emergencyRelationship.label} name="emergencyRelationship" type="text" value={data.emergencyRelationship} placeholder={t.emergencyRelationship.placeholder} handleChange={handleChange} error={errors.emergencyRelationship} required />
      </div>
    </div>
  );
};

export default FormStep1;
