import React from 'react';
import { motion } from 'framer-motion';
import { Language } from '../types';
import type { ProgramType } from '../types';

interface ProgramCardsProps {
  language: Language;
}

interface ProgramCard {
  id: string;
  programType: ProgramType;
  title: { en: string; fr: string };
  price: string;
  period: { en: string; fr: string };
  features: { en: string[]; fr: string[] };
  popular?: boolean;
  icon: string;
  comingSoon?: boolean;
}

// Credit-based pricing - no more 1x/2x distinction
// Parents buy credits and book any available time slots
const programs: ProgramCard[] = [
  {
    id: 'group',
    programType: 'group',
    title: { en: 'Group Training', fr: 'Entraînement de Groupe' },
    price: 'From $25',
    period: { en: '/session', fr: '/session' },
    popular: true,
    icon: '/images/hockey-puck-icon.png',
    features: {
      en: [
        'Book any available time slot',
        'Age-specific sessions (M9 to Junior)',
        'Professional coaching',
        'Buy 1 ($45), 10 ($350), 20 ($500), or 50 ($1,000) sessions',
        'Sessions valid for 12 months',
        'Best value with 50-pack ($20/session)!',
      ],
      fr: [
        'Réservez n\'importe quel créneau disponible',
        'Sessions par groupe d\'âge (M9 à Junior)',
        'Coaching professionnel',
        'Achetez 1 (45$), 10 (350$), 20 (500$) ou 50 (1 000$) sessions',
        'Sessions valides 12 mois',
        'Meilleure valeur avec le pack de 50 (20$/session)!',
      ],
    },
  },
  {
    id: 'sunday-ice',
    programType: 'group',
    title: { en: 'Sunday Ice Practice', fr: 'Pratique sur Glace du Dimanche' },
    price: '$50',
    period: { en: '/session', fr: '/session' },
    icon: '/images/hockey-skates-icon.png',
    features: {
      en: [
        'Real ice practice session',
        'Available for all registered players',
        'Book per session',
        'Great for game preparation',
        'Limited spots - book early!',
      ],
      fr: [
        'Session de pratique sur vraie glace',
        'Disponible pour tous les joueurs inscrits',
        'Réservez par session',
        'Idéal pour la préparation aux matchs',
        'Places limitées - réservez tôt!',
      ],
    },
  },
  {
    id: 'semi-private',
    programType: 'semi-private',
    title: { en: 'Semi-Private Training', fr: 'Entraînement Semi-Privé' },
    price: '$69',
    period: { en: '/session', fr: '/session' },
    icon: '/images/hockey-skates-icon.png',
    features: {
      en: [
        'Small group (2-3 players)',
        'Matched by skill & age',
        'Book per session',
        'Flexible scheduling',
        'Personal attention',
      ],
      fr: [
        'Petit groupe (2-3 joueurs)',
        'Jumelage par compétence et âge',
        'Réservez par session',
        'Horaire flexible',
        'Attention personnelle',
      ],
    },
  },
  {
    id: 'private',
    programType: 'private',
    title: { en: 'Private Training', fr: 'Entraînement Privé' },
    price: '$89.99',
    period: { en: '/session', fr: '/session' },
    icon: '/images/coach-icon.png',
    features: {
      en: [
        'One-on-one coaching',
        'Customized training plan',
        'Book per session',
        'Personalized feedback',
        'Video analysis',
      ],
      fr: [
        'Coaching individuel',
        'Plan d\'entraînement personnalisé',
        'Réservez par session',
        'Rétroaction personnalisée',
        'Analyse vidéo',
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

const ProgramCards: React.FC<ProgramCardsProps> = ({ language }) => {
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
              ? 'Buy credits and book any available time slots'
              : 'Achetez des crédits et réservez n\'importe quel créneau disponible'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {programs.map((program, index) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={program.comingSoon ? {} : { scale: 1.05, y: -5 }}
              className={`relative bg-black rounded-2xl border-2 p-8 flex flex-col ${
                program.comingSoon
                  ? 'border-white/10 opacity-60'
                  : program.popular
                  ? 'border-[#9BD4FF] shadow-2xl shadow-[#9BD4FF]/20'
                  : 'border-white/10 hover:border-[#9BD4FF]/50'
              }`}
            >
              {/* Coming Soon Badge */}
              {program.comingSoon && (
                <span className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-4 py-1 rounded-full uppercase">
                  {lang === 'en' ? 'Coming Soon' : 'Bientôt Disponible'}
                </span>
              )}

              {/* Popular Badge */}
              {program.popular && !program.comingSoon && (
                <span className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-[#9BD4FF] text-black text-xs font-bold px-4 py-1 rounded-full uppercase">
                  {lang === 'en' ? 'Most Popular' : 'Plus Populaire'}
                </span>
              )}

              <div className="flex-grow">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={program.icon}
                    alt=""
                    className={`w-12 h-12 object-contain ${program.comingSoon ? 'grayscale' : ''}`}
                  />
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider">
                    {program.title[lang]}
                  </h3>
                </div>

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

              {program.comingSoon ? (
                <button
                  disabled
                  className="w-full font-bold py-3 px-6 rounded-lg text-sm uppercase tracking-wider bg-gray-600 text-gray-400 cursor-not-allowed"
                >
                  {lang === 'en' ? 'Coming Soon' : 'Bientôt'}
                </button>
              ) : (
                <a
                  href="/signup"
                  className={`block w-full text-center font-bold py-3 px-6 rounded-lg text-sm uppercase tracking-wider transition-all duration-300 ${
                    program.popular
                      ? 'bg-[#9BD4FF] text-black hover:shadow-[0_0_15px_rgba(155,212,255,0.8)]'
                      : 'bg-white/10 text-white hover:bg-[#9BD4FF] hover:text-black'
                  }`}
                >
                  {lang === 'en' ? 'Get Started' : 'Commencer'}
                </a>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramCards;
