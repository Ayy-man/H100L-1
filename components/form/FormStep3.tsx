import React from 'react';
import { FormData, Language } from '../../types';
import { content } from '../../constants';
import FormInput from './FormInput';
import FormSelect from './FormSelect';
import FormCheckbox from './FormCheckbox';

interface FormStep3Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  // FIX: Update handleChange to support all element types used in this form step.
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  language: Language;
}

const FormStep3: React.FC<FormStep3Props> = ({ data, errors, handleChange, language }) => {
  const t = content[language].form.step3;
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">{t.hockeyInfoHeader}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput label={t.position.label} name="position" type="text" value={data.position} handleChange={handleChange} />
            <FormSelect label={t.dominantHand.label} name="dominantHand" value={data.dominantHand} handleChange={handleChange}>
                <option value="">{t.dominantHand.selectHand}</option>
                <option value="Left">{t.dominantHand.left}</option>
                <option value="Right">{t.dominantHand.right}</option>
            </FormSelect>
            <FormInput label={t.currentLevel.label} name="currentLevel" type="text" value={data.currentLevel} handleChange={handleChange} />
             <FormSelect label={t.jerseySize.label} name="jerseySize" value={data.jerseySize} handleChange={handleChange} error={errors.jerseySize} required>
                <option value="">{t.jerseySize.selectSize}</option>
                <option value="YS">YS (Youth Small)</option>
                <option value="YM">YM (Youth Medium)</option>
                <option value="YL">YL (Youth Large)</option>
                <option value="S">S (Adult Small)</option>
                <option value="M">M (Adult Medium)</option>
                <option value="L">L (Adult Large)</option>
                <option value="XL">XL (Adult Extra Large)</option>
             </FormSelect>
             <FormSelect label={t.primaryObjective.label} name="primaryObjective" value={data.primaryObjective} handleChange={handleChange} error={errors.primaryObjective} required>
                <option value="">{t.primaryObjective.placeholder}</option>
                <option value="Shooting">{t.shooting}</option>
                <option value="Puck Handling">{t.puckHandling}</option>
                <option value="Skating">{t.skating}</option>
                <option value="Endurance">{t.endurance}</option>
             </FormSelect>
        </div>

      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">{t.healthMedicalHeader}</h3>
      
      <FormCheckbox label={t.hasAllergies} name="hasAllergies" checked={data.hasAllergies} handleChange={handleChange} />
      {data.hasAllergies && (
          <FormInput label={t.allergiesDetails.label} name="allergiesDetails" type="textarea" value={data.allergiesDetails} handleChange={handleChange} />
      )}

      <FormCheckbox label={t.hasMedicalConditions} name="hasMedicalConditions" checked={data.hasMedicalConditions} handleChange={handleChange} />
      {data.hasMedicalConditions && (
          <FormInput label={t.medicalConditionsDetails.label} name="medicalConditionsDetails" type="textarea" value={data.medicalConditionsDetails} handleChange={handleChange} />
      )}

      <FormCheckbox
        label={t.carriesMedication}
        name="carriesMedication"
        checked={data.carriesMedication}
        handleChange={handleChange}
      />
      {data.carriesMedication && (
        <div className="space-y-4 pl-6 border-l-2 border-[#9BD4FF]/20">
          <FormInput
            label={t.medicationDetails.label}
            name="medicationDetails"
            type="textarea"
            value={data.medicationDetails}
            handleChange={handleChange}
            error={errors.medicationDetails}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t.medicationActionPlan.label} <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              name="medicationActionPlan"
              onChange={handleChange}
              accept=".pdf"
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#9BD4FF]/10 file:text-[#9BD4FF] hover:file:bg-[#9BD4FF]/20"
            />
            {errors.medicationActionPlan && <p className="mt-2 text-sm text-red-500">{errors.medicationActionPlan}</p>}
            <p className="text-xs text-gray-400 mt-1">{t.medicationActionPlan.helpText}</p>
          </div>
        </div>
      )}

       <div>
         <label className="block text-sm font-medium text-gray-300 mb-2">{t.medicalReport.label}</label>
         <input type="file" name="medicalReport" onChange={handleChange} accept=".pdf" className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#9BD4FF]/10 file:text-[#9BD4FF] hover:file:bg-[#9BD4FF]/20"/>
         {errors.medicalReport && <p className="mt-2 text-sm text-red-500">{errors.medicalReport}</p>}
       </div>


      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">{t.consentsHeader}</h3>
      <div className="space-y-4">
        <FormCheckbox
            name="photoVideoConsent"
            checked={data.photoVideoConsent}
            handleChange={handleChange}
            error={errors.photoVideoConsent}
            required
            label={t.photoVideoConsent}
        />
        <FormCheckbox
            name="policyAcceptance"
            checked={data.policyAcceptance}
            handleChange={handleChange}
            error={errors.policyAcceptance}
            required
            label={<span>{t.policyAcceptance} <a href="#" target="_blank" rel="noopener noreferrer" className="text-[#9BD4FF] hover:underline">{t.termsLink}</a>.</span>}
        />
      </div>
    </div>
  );
};

export default FormStep3;