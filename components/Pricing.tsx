import React from 'react';
import { motion } from 'framer-motion';

interface PricingProps {
  content: {
    title: string;
    planName: string;
    price: string;
    period: string;
    features: string[];
    cta: string;
  };
  onRegisterClick: () => void;
}

const CheckIcon = () => (
    <svg className="w-6 h-6 text-[#9BD4FF] mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
);

const Pricing: React.FC<PricingProps> = ({ content, onRegisterClick }) => {

  return (
    <section id="pricing" className="py-20 md:py-32 bg-gray-900/50">
      <div className="container mx-auto px-6 flex flex-col items-center">
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4 uppercase tracking-tighter">{content.title}</h2>
          <p className="text-xl text-gray-400 text-center mb-16">One simple plan. Unlimited potential.</p>
        </motion.div>
        
        <motion.div 
          className="bg-black rounded-2xl border-2 border-[#9BD4FF] shadow-2xl shadow-[#9BD4FF]/20 p-8 md:p-12 w-full max-w-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          whileHover={{ scale: 1.02, y: -5 }}
        >
          <div className="flex justify-between items-baseline">
            <h3 className="text-2xl font-bold text-white uppercase tracking-wider">{content.planName}</h3>
            <span className="bg-[#9BD4FF] text-black text-xs font-bold px-3 py-1 rounded-full uppercase">Launch Offer</span>
          </div>
          
          <div className="my-8 text-center">
            <span className="text-6xl font-black text-white">{content.price}</span>
            <span className="text-2xl text-gray-400 font-semibold">{content.period}</span>
          </div>

          <ul className="space-y-4 mb-10">
            {content.features.map((feature, index) => (
              <li key={index} className="flex items-center text-gray-300">
                <CheckIcon />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={onRegisterClick}
            className="w-full bg-[#9BD4FF] text-black font-bold py-4 px-10 rounded-lg text-lg uppercase tracking-wider transition-all duration-300 hover:shadow-[0_0_15px_rgba(155,212,255,0.8),0_0_25px_rgba(155,212,255,0.5)] hover:scale-105"
          >
            {content.cta}
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
