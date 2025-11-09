import React from 'react';
import { FormData, ProgramType } from '../../types';
import FormSelect from './FormSelect';
import { motion, AnimatePresence } from 'framer-motion';

interface FormStep2Props {
  data: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleMultiSelectChange: (name: keyof FormData, option: string) => void;
}

const slideDown = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.3 } },
    exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

const FormStep2: React.FC<FormStep2Props> = ({ data, errors, handleChange, handleMultiSelectChange }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-white/10 pb-2">Program Selection</h3>
      <FormSelect label="Select Program Type" name="programType" value={data.programType} handleChange={handleChange} error={errors.programType} required>
        <option value="">-- Choose a Program --</option>
        <option value="group">Group Training</option>
        <option value="private">Private Training</option>
        <option value="semi-private">Semi-Private Training</option>
      </FormSelect>
      
      <AnimatePresence>
        {data.programType === 'group' && (
          <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
            <h4 className="font-bold text-[#9BD4FF]">Group Training Details</h4>
            <FormSelect label="Frequency" name="groupFrequency" value={data.groupFrequency} handleChange={handleChange} error={errors.groupFrequency} required>
                <option value="">-- Select Frequency --</option>
                <option value="1x">1x / week</option>
                <option value="2x">2x / week</option>
            </FormSelect>
            {data.groupFrequency === '1x' && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Day <span className="text-red-500">*</span></label>
                    <div className="flex gap-4">
                        {['tuesday', 'friday'].map(day => (
                            <label key={day} className={`flex-1 p-4 border-2 rounded-lg cursor-pointer text-center ${data.groupDay === day ? 'border-[#9BD4FF] bg-[#9BD4FF]/10' : 'border-white/20'}`}>
                                <input type="radio" name="groupDay" value={day} checked={data.groupDay === day} onChange={handleChange} className="sr-only" />
                                <span className="capitalize">{day}</span>
                            </label>
                        ))}
                    </div>
                    {errors.groupDay && <p className="mt-2 text-sm text-red-500">{errors.groupDay}</p>}
                </div>
            )}
             {data.groupFrequency === '2x' && (
                <div className="text-sm text-gray-300 p-4 bg-white/10 rounded-lg">
                    Sessions are automatically scheduled for **Tuesday & Friday**.
                </div>
            )}
          </motion.div>
        )}

        {data.programType === 'private' && (
            <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-[#9BD4FF]">Private Training Details</h4>
                {/* Add Private Fields */}
                <p className="text-gray-400">Private training options coming soon.</p>
            </motion.div>
        )}

        {data.programType === 'semi-private' && (
             <motion.div variants={slideDown} initial="initial" animate="animate" exit="exit" className="space-y-6 bg-white/5 p-6 rounded-lg overflow-hidden">
                <h4 className="font-bold text-[#9BD4FF]">Semi-Private Training Details</h4>
                {/* Add Semi-Private Fields */}
                <p className="text-gray-400">Semi-Private training options coming soon.</p>
            </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default FormStep2;
