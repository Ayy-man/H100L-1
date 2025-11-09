import React from 'react';
import { FormData } from '../../types';
import FormInput from './FormInput';
import FormSelect from './FormSelect';
import FormCheckbox from './FormCheckbox';

interface FormStep3Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  // FIX: Update handleChange to support all element types used in this form step.
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const FormStep3: React.FC<FormStep3Props> = ({ data, errors, handleChange }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Hockey Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput label="Position" name="position" type="text" value={data.position} handleChange={handleChange} />
            <FormSelect label="Dominant Hand" name="dominantHand" value={data.dominantHand} handleChange={handleChange}>
                <option value="">-- Select Hand --</option>
                <option value="Left">Left</option>
                <option value="Right">Right</option>
            </FormSelect>
            <FormInput label="Current Level (e.g., AA, AAA)" name="currentLevel" type="text" value={data.currentLevel} handleChange={handleChange} />
             <FormSelect label="Jersey Size" name="jerseySize" value={data.jerseySize} handleChange={handleChange} error={errors.jerseySize} required>
                <option value="">-- Select Size --</option>
                <option value="Youth S">Youth S</option>
                <option value="Youth M">Youth M</option>
                <option value="Youth L">Youth L</option>
                <option value="Youth XL">Youth XL</option>
                <option value="Adult S">Adult S</option>
                <option value="Adult M">Adult M</option>
                <option value="Adult L">Adult L</option>
             </FormSelect>
        </div>

      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">Health & Medical</h3>
      
      <FormCheckbox label="Player has allergies" name="hasAllergies" checked={data.hasAllergies} handleChange={handleChange} />
      {data.hasAllergies && (
          <FormInput label="Please provide details" name="allergiesDetails" type="textarea" value={data.allergiesDetails} handleChange={handleChange} />
      )}
      
      <FormCheckbox label="Player has existing medical conditions" name="hasMedicalConditions" checked={data.hasMedicalConditions} handleChange={handleChange} />
      {data.hasMedicalConditions && (
          <FormInput label="Please provide details" name="medicalConditionsDetails" type="textarea" value={data.medicalConditionsDetails} handleChange={handleChange} />
      )}
       
       <div>
         <label className="block text-sm font-medium text-gray-300 mb-2">Upload Medical Report (Optional, PDF only, max 5MB)</label>
         <input type="file" name="medicalReport" onChange={handleChange} accept=".pdf" className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#9BD4FF]/10 file:text-[#9BD4FF] hover:file:bg-[#9BD4FF]/20"/>
         {errors.medicalReport && <p className="mt-2 text-sm text-red-500">{errors.medicalReport}</p>}
       </div>


      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2 pt-4">Consents</h3>
      <div className="space-y-4">
        <FormCheckbox 
            name="photoVideoConsent"
            checked={data.photoVideoConsent} 
            handleChange={handleChange}
            error={errors.photoVideoConsent}
            required
            label="I consent to the use of photos and videos of the player for promotional purposes."
        />
        <FormCheckbox 
            name="policyAcceptance"
            checked={data.policyAcceptance} 
            handleChange={handleChange}
            error={errors.policyAcceptance}
            required
            label={<span>I have read and agree to the <a href="#" className="text-[#9BD4FF] hover:underline">Terms of Service and Waiver</a>.</span>}
        />
      </div>
    </div>
  );
};

export default FormStep3;