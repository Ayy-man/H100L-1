import React from 'react';

interface FormSelectProps {
  label: string;
  name: string;
  value: string;
  error?: string;
  handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  required?: boolean;
}

const FormSelect: React.FC<FormSelectProps> = ({ label, name, value, error, handleChange, children, required }) => {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={handleChange}
        className={`w-full bg-white/10 border-2 rounded-lg py-3 px-4 text-white
                   focus:outline-none focus:ring-2 focus:ring-[#9BD4FF] transition appearance-none
                   bg-no-repeat bg-right pr-8
                   ${error ? 'border-red-500 focus:ring-red-500' : 'border-white/20'}`}
        style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1.5em 1.5em'
        }}
      >
        {children}
      </select>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default FormSelect;
