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
                <option value="YS">YS (Youth Small)</option>
                <option value="YM">YM (Youth Medium)</option>
                <option value="YL">YL (Youth Large)</option>
                <option value="S">S (Adult Small)</option>
                <option value="M">M (Adult Medium)</option>
                <option value="L">L (Adult Large)</option>
                <option value="XL">XL (Adult Extra Large)</option>
             </FormSelect>
             <FormSelect label="Primary Training Objective" name="primaryObjective" value={data.primaryObjective} handleChange={handleChange} error={errors.primaryObjective} required>
                <option value="">-- Select Objective --</option>
                <option value="Shooting">Shooting</option>
                <option value="Puck Handling">Puck Handling</option>
                <option value="Skating">Skating</option>
                <option value="Endurance">Endurance</option>
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

      <FormCheckbox
        label="Player carries medication (EpiPen, inhaler, etc.)"
        name="carriesMedication"
        checked={data.carriesMedication}
        handleChange={handleChange}
      />
      {data.carriesMedication && (
        <div className="space-y-4 pl-6 border-l-2 border-[#9BD4FF]/20">
          <FormInput
            label="Medication Details"
            name="medicationDetails"
            type="textarea"
            value={data.medicationDetails}
            handleChange={handleChange}
            error={errors.medicationDetails}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload Action Plan (PDF, max 5MB) <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              name="medicationActionPlan"
              onChange={handleChange}
              accept=".pdf"
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#9BD4FF]/10 file:text-[#9BD4FF] hover:file:bg-[#9BD4FF]/20"
            />
            {errors.medicationActionPlan && <p className="mt-2 text-sm text-red-500">{errors.medicationActionPlan}</p>}
            <p className="text-xs text-gray-400 mt-1">Please upload your emergency action plan for medication administration</p>
          </div>
        </div>
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
            label={<span>I have read and agree to the <a href="#" target="_blank" rel="noopener noreferrer" className="text-[#9BD4FF] hover:underline">Terms of Service and Waiver</a>.</span>}
        />
      </div>
    </div>
  );
};

export default FormStep3;