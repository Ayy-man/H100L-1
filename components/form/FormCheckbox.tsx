import React from 'react';

interface FormCheckboxProps {
  label: React.ReactNode;
  name: string;
  checked: boolean;
  error?: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}

const FormCheckbox: React.FC<FormCheckboxProps> = ({ label, name, checked, error, handleChange, required }) => {
  return (
    <div>
        <div className="flex items-start">
            <input
            id={name}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            className="h-4 w-4 mt-1 rounded border-gray-300 text-[#9BD4FF] focus:ring-[#9BD4FF] bg-white/10"
            />
            <div className="ml-3 text-sm">
                <label htmlFor={name} className="font-medium text-gray-300">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            </div>
        </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default FormCheckbox;
