import React from 'react';
import { CustomSelect } from './CustomSelect';

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
  // Parse children to extract options (including disabled state)
  const options = React.Children.toArray(children).map((child) => {
    if (React.isValidElement(child) && child.type === 'option') {
      return {
        value: (child.props.value as string) || '',
        label: child.props.children as string,
        disabled: child.props.disabled === true
      };
    }
    return { value: '', label: '', disabled: false };
  });

  // Convert the onChange handler to work with CustomSelect
  const handleCustomChange = (newValue: string) => {
    // Create a synthetic event to maintain compatibility with existing code
    const syntheticEvent = {
      target: {
        name,
        value: newValue
      }
    } as React.ChangeEvent<HTMLSelectElement>;

    handleChange(syntheticEvent);
  };

  return (
    <CustomSelect
      label={label}
      name={name}
      value={value}
      error={error}
      onChange={handleCustomChange}
      options={options}
      required={required}
    />
  );
};

export default FormSelect;
