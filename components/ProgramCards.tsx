import React from 'react';
import { motion } from 'framer-motion';
import { Language, ProgramType } from '../types';

interface ProgramCardsProps {
  language: Language;
  onProgramSelect: (programType: ProgramType, frequency: '1x' | '2x' | '') => void;
}

interface ProgramCard {
  id: string;
  programType: ProgramType;
  frequency: '1x' | '2x' | '';
  title: { en: string; fr: string };
  price: string;
  period: { en: string; fr: string };
  features: { en: string[]; fr: string[] };
  popular?: boolean;
}

const programs: ProgramCard[] = [
  {
    id: 'group-1x',
    programType: 'group',
    frequency: '1x',
    title: { en: 'Group Training - 1x/week', fr: 'Entraînement de Groupe - 1x/semaine' },
    price: '$249.99',
    period: { en: '/month', fr: '/mois' },
    features: {
      en: [
        'Weekly group session',
        'Age-specific time slots',
        'Professional coaching',
        'Monthly Sunday practice',
        'Progress tracking',
      ],
      fr: [
        'Session de groupe hebdomadaire',
        'Créneaux horaires par âge',
        'Coaching professionnel',
        'Pratique dominicale mensuelle',
        'Suivi des progrès',
      ],
    },
  },
  {
    id: 'group-2x',
    programType: 'group',
    frequency: '2x',
    title: { en: 'Group Training - 2x/week', fr: 'Entraînement de Groupe - 2x/semaine' },
    price: '$399.99',
    period: { en: '/month', fr: '/mois' },
    popular: true,
    features: {
      en: [
        'Twice weekly sessions (Tue & Fri)',
        'Age-specific time slots',
        'Professional coaching',
        'Monthly Sunday practice',
        'Accelerated progress',
        'Priority support',
      ],
      fr: [
        'Sessions bi-hebdomadaires (Mar & Ven)',
        'Créneaux horaires par âge',
        'Coaching professionnel',
        'Pratique dominicale mensuelle',
        'Progression accélérée',
        'Support prioritaire',
      ],
    },
  },
  {
    id: 'private-1x',
    programType: 'private',
    frequency: '1x',
    title: { en: 'Private Training - 1x/week', fr: 'Entraînement Privé - 1x/semaine' },
    price: '$499.99',
    period: { en: '/month', fr: '/mois' },
    features: {
      en: [
        'One-on-one coaching',
        'Customized training plan',
        'Flexible day selection',
        'Personalized feedback',
        'Video analysis',
      ],
      fr: [
        'Coaching individuel',
        'Plan d\'entraînement personnalisé',
        'Sélection de jour flexible',
        'Rétroaction personnalisée',
        'Analyse vidéo',
      ],
    },
  },
  {
    id: 'private-2x',
    programType: 'private',
    frequency: '2x',
    title: { en: 'Private Training - 2x/week', fr: 'Entraînement Privé - 2x/semaine' },
    price: '$799.99',
    period: { en: '/month', fr: '/mois' },
    features: {
      en: [
        'Twice weekly one-on-one',
        'Elite customized program',
        'Flexible day selection',
        'Intensive skill development',
        'Video analysis & reports',
        'Direct coach communication',
      ],
      fr: [
        'Sessions individuelles bi-hebdomadaires',
        'Programme personnalisé élite',
        'Sélection de jour flexible',
        'Développement intensif des compétences',
        'Analyse vidéo et rapports',
        'Communication directe avec l\'entraîneur',
      ],
    },
  },
  {
    id: 'semi-private',
    programType: 'semi-private',
    frequency: '',
    title: { en: 'Semi-Private Training', fr: 'Entraînement Semi-Privé' },
    price: '$349.99',
    period: { en: '/month', fr: '/mois' },
    features: {
      en: [
        'Small group (2-3 players)',
        'Matched by skill & age',
        'Customized group program',
        'Flexible scheduling',
        'Personal attention',
      ],
      fr: [
        'Petit groupe (2-3 joueurs)',
        'Jumelage par compétence et âge',
        'Programme de groupe personnalisé',
        'Horaire flexible',
        'Attention personnelle',
      ],
    },
  },
];

const CheckIcon = () => (
  <svg
    className="w-5 h-5 text-[#9BD4FF] mr-2 flex-shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
);

const ProgramCards: React.FC<ProgramCardsProps> = ({ language, onProgramSelect }) => {
  const lang = language === Language.EN ? 'en' : 'fr';

  return (
    <section id="programs" className="py-20 md:py-32 bg-gray-900/50">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4">
            {lang === 'en' ? 'Choose Your Program' : 'Choisissez Votre Programme'}
          </h2>
          <p className="text-xl text-gray-400">
            {lang === 'en'
              ? 'Select the training program that fits your goals'
              : 'Sélectionnez le programme qui correspond à vos objectifs'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {programs.map((program, index) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className={`relative bg-black rounded-2xl border-2 p-8 flex flex-col ${
                program.popular
                  ? 'border-[#9BD4FF] shadow-2xl shadow-[#9BD4FF]/20'
                  : 'border-white/10 hover:border-[#9BD4FF]/50'
              }`}
            >
              {program.popular && (
                <span className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-[#9BD4FF] text-black text-xs font-bold px-4 py-1 rounded-full uppercase">
                  {lang === 'en' ? 'Most Popular' : 'Plus Populaire'}
                </span>
              )}

              <div className="flex-grow">
                <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-4">
                  {program.title[lang]}
                </h3>

                <div className="mb-6">
                  <span className="text-4xl font-black text-white">{program.price}</span>
                  <span className="text-lg text-gray-400 font-semibold">{program.period[lang]}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {program.features[lang].map((feature, idx) => (
                    <li key={idx} className="flex items-start text-sm text-gray-300">
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => onProgramSelect(program.programType, program.frequency)}
                className={`w-full font-bold py-3 px-6 rounded-lg text-sm uppercase tracking-wider transition-all duration-300 ${
                  program.popular
                    ? 'bg-[#9BD4FF] text-black hover:shadow-[0_0_15px_rgba(155,212,255,0.8)]'
                    : 'bg-white/10 text-white hover:bg-[#9BD4FF] hover:text-black'
                }`}
              >
                {lang === 'en' ? 'Select Program' : 'Choisir Programme'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramCards;
