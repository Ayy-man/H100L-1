import React, { useState, useRef, useEffect } from 'react';

interface CustomSelectProps {
  label: string;
  name: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  name,
  value,
  error,
  onChange,
  options,
  required = false,
  placeholder = '-- Select an option --'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Find the display label for the current value
  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  // Calculate dropdown position when opening
  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    };

    if (isOpen) {
      updatePosition();
      // Update position on scroll
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Close dropdown when scrolling the parent container
      const scrollableParent = containerRef.current?.closest('.overflow-y-auto');
      if (scrollableParent) {
        scrollableParent.addEventListener('scroll', handleScroll);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        if (scrollableParent) {
          scrollableParent.removeEventListener('scroll', handleScroll);
        }
      };
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="block text-sm font-medium text-white">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative" ref={containerRef}>
        {/* Custom Select Button */}
        <button
          ref={buttonRef}
          type="button"
          id={name}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={`w-full bg-white/10 border-2 rounded-lg py-3 px-4 text-left text-white
                     focus:outline-none focus:ring-2 focus:ring-[#9BD4FF] transition
                     flex items-center justify-between
                     ${error ? 'border-red-500 focus:ring-red-500' : 'border-white/20'}
                     ${!value ? 'text-gray-400' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{displayValue}</span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Custom Dropdown Menu */}
        {isOpen && (
          <div
            className="fixed z-[9999] bg-[#1a1a1a] border-2 border-white/20 rounded-lg shadow-xl max-h-60 overflow-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`
            }}
            role="listbox"
          >
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                className={`px-4 py-3 cursor-pointer transition-colors
                           ${value === option.value
                             ? 'bg-[#9BD4FF]/20 text-[#9BD4FF]'
                             : 'text-white hover:bg-white/10'}
                           ${option.value === '' ? 'text-gray-400' : ''}`}
                role="option"
                aria-selected={value === option.value}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
};
