import React from 'react';

interface ProgressIndicatorProps {
  currentStep: number;
  steps: { id: number; title: string }[];
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep, steps }) => {
  return (
    <div className="w-full mt-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300
                    ${isCompleted ? 'bg-[#9BD4FF] text-black' : ''}
                    ${isActive ? 'bg-white/10 border-2 border-[#9BD4FF] text-[#9BD4FF]' : ''}
                    ${!isCompleted && !isActive ? 'bg-white/10 border-2 border-white/20 text-gray-400' : ''}
                  `}
                >
                  {isCompleted ? '✓' : step.id}
                </div>
                <p className={`mt-2 text-xs text-center transition-colors duration-300 ${isActive || isCompleted ? 'text-white' : 'text-gray-500'}`}>{step.title}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded
                  ${currentStep > step.id ? 'bg-[#9BD4FF]' : 'bg-white/10'}
                `}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressIndicator;
