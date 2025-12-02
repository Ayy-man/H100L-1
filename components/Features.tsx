import React from 'react';
import { motion } from 'framer-motion';

interface FeaturesProps {
  content: {
    title: string;
    synthetic: { title: string; description: string };
    real: { title: string; description: string };
    pro: { title: string; description: string };
  };
}

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

interface FeatureCardProps {
  iconSrc: string;
  iconAlt: string;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ iconSrc, iconAlt, title, description }) => (
  <motion.div
    className="bg-gray-800 p-8 rounded-xl border border-gray-700 text-center"
    variants={cardVariants}
  >
    <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
      <img
        src={iconSrc}
        alt={iconAlt}
        className="w-14 h-14 object-contain"
      />
    </div>
    <h3 className="text-2xl font-bold mb-2 text-white">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </motion.div>
);

const Features: React.FC<FeaturesProps> = ({ content }) => {
  return (
    <section id="features" className="py-20 md:py-32 bg-gray-900">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-5xl font-black text-center mb-16 uppercase tracking-tighter">
            {content.title}
          </h2>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          transition={{ staggerChildren: 0.2 }}
        >
          <FeatureCard
            iconSrc="/images/hockey-puck-icon.png"
            iconAlt="Synthetic Ice Training"
            title={content.synthetic.title}
            description={content.synthetic.description}
          />
          <FeatureCard
            iconSrc="/images/hockey-skates-icon.png"
            iconAlt="Real Ice Drills"
            title={content.real.title}
            description={content.real.description}
          />
          <FeatureCard
            iconSrc="/images/coach-icon.png"
            iconAlt="Professional Coaching"
            title={content.pro.title}
            description={content.pro.description}
          />
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
