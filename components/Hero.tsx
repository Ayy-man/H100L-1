import React from 'react';
// FIX: Import Variants type to correctly type motion variants.
import { motion, Variants } from 'framer-motion';

interface HeroProps {
  content: {
    title: string;
    subtitle: string;
    cta: string;
  };
  onRegisterClick: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

const Hero: React.FC<HeroProps> = ({ content, onRegisterClick }) => {
  return (
    <section className="relative h-screen flex items-center justify-center text-center px-6 pt-16">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: 'url(https://picsum.photos/seed/hockey/1920/1080)' }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent"></div>
      
      <motion.div
        className="relative z-10 max-w-4xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1 
          className="text-4xl md:text-7xl font-black tracking-tighter uppercase"
          variants={itemVariants}
        >
          {content.title}
        </motion.h1>
        <motion.p 
          className="mt-4 max-w-2xl mx-auto text-lg md:text-xl text-gray-300"
          variants={itemVariants}
        >
          {content.subtitle}
        </motion.p>
        <motion.div variants={itemVariants}>
          <button
            onClick={onRegisterClick}
            className="mt-8 inline-block bg-[#9BD4FF] text-black font-bold py-4 px-10 rounded-lg text-lg uppercase tracking-wider transition-all duration-300 hover:shadow-[0_0_15px_rgba(155,212,255,0.8),0_0_25px_rgba(155,212,255,0.5)] hover:scale-105"
          >
            {content.cta}
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;