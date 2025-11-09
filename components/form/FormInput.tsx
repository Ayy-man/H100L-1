import React from 'react';

interface FormInputProps {
  label: string;
  name: string;
  type: string;
  value: string;
  placeholder?: string;
  error?: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({ label, name, type, value, placeholder, error, handleChange, required }) => {
  const isTextarea = type === 'textarea';
  const InputComponent = isTextarea ? 'textarea' : 'input';

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <InputComponent
        type={isTextarea ? undefined : type}
        id={name}
        name={name}
        value={value}
        onChange={handleChange}
        className={`w-full bg-white/10 border-2 rounded-lg py-3 px-4 text-white placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-[#9BD4FF] transition
                   ${error ? 'border-red-500 focus:ring-red-500' : 'border-white/20'}`}
        placeholder={placeholder}
        rows={isTextarea ? 4 : undefined}
      />
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default FormInput;
