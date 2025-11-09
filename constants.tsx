
import React from 'react';

export const content = {
  en: {
    nav: {
      program: 'The Program',
      pricing: 'Pricing',
      contact: 'Contact',
    },
    hero: {
      title: 'Elevate Your Game. Dominate The Ice.',
      subtitle: 'Elite hockey training for dedicated players. Join SniperZone and unlock your potential with our paid monthly subscription.',
      cta: 'Register Now',
    },
    features: {
      title: 'Our Elite Program',
      synthetic: {
        title: 'Synthetic Ice Training',
        description: 'Perfect your shot and stickhandling on our state-of-the-art synthetic ice surfaces during weekday sessions.',
      },
      real: {
        title: 'Real Ice Drills',
        description: 'Apply your skills on real ice every Sunday, focusing on game situations, skating, and team play.',
      },
      pro: {
        title: 'Professional Coaching',
        description: 'Learn from experienced coaches dedicated to player development, providing personalized feedback.',
      },
    },
    pricing: {
      title: 'Join The Elite',
      planName: 'Monthly Subscription',
      price: '$299',
      period: '/month',
      features: [
        'Unlimited Weekday Synthetic Ice Sessions',
        'Guaranteed Sunday Real Ice Slot',
        'Personalized Coaching Feedback',
        'Access to Pro-Level Equipment',
        'Monthly Progress Reports',
      ],
      cta: 'Start My Subscription',
    },
    footer: {
      copy: `© ${new Date().getFullYear()} SniperZone Hockey. All rights reserved.`
    }
  },
  fr: {
    nav: {
      program: 'Le Programme',
      pricing: 'Tarifs',
      contact: 'Contact',
    },
    hero: {
      title: 'Élevez Votre Jeu. Dominez La Glace.',
      subtitle: 'Entraînement de hockey élite pour joueurs dédiés. Rejoignez SniperZone et libérez votre potentiel avec notre abonnement mensuel payant.',
      cta: 'Inscrivez-vous maintenant',
    },
    features: {
      title: 'Notre Programme Élite',
      synthetic: {
        title: 'Entraînement sur Glace Synthétique',
        description: 'Perfectionnez votre tir et votre maniement de bâton sur nos surfaces de glace synthétique de pointe durant les sessions de semaine.',
      },
      real: {
        title: 'Exercices sur Vraie Glace',
        description: 'Appliquez vos compétences sur de la vraie glace chaque dimanche, en vous concentrant sur les situations de match, le patinage et le jeu d\'équipe.',
      },
      pro: {
        title: 'Coaching Professionnel',
        description: 'Apprenez de coachs expérimentés dédiés au développement des joueurs, fournissant des retours personnalisés.',
      },
    },
    pricing: {
      title: 'Rejoignez L\'Élite',
      planName: 'Abonnement Mensuel',
      price: '299$',
      period: '/mois',
      features: [
        'Sessions illimitées sur glace synthétique en semaine',
        'Place garantie sur vraie glace le dimanche',
        'Retours personnalisés des coachs',
        'Accès à de l\'équipement de niveau pro',
        'Rapports de progrès mensuels',
      ],
      cta: 'Démarrer Mon Abonnement',
    },
    footer: {
      copy: `© ${new Date().getFullYear()} Hockey SniperZone. Tous droits réservés.`
    }
  },
};


export const HockeyPuckIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.48 2 2 3.79 2 6c0 2.21 4.48 4 10 4s10-1.79 10-4c0-2.21-4.48-4-10-4zM2 9v6c0 2.21 4.48 4 10 4s10-1.79 10-4V9c-2.83 1.4-6.31 2-10 2s-7.17-.6-10-2z" />
  </svg>
);

export const IceSkateIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M21.99 15.5c-1.39-1.39-3.26-2.2-5.3-2.34l-1.4-3.88c-.2-.55-.76-.88-1.34-.88H7.09l-.43-1.2c-.2-.56-.76-.88-1.34-.88H2c-.55 0-1 .45-1 1s.45 1 1 1h2.22l2.69 7.48c-.46.33-.87.75-1.22 1.22C4.08 17.92 3 20.06 3 22h2c0-1.69.83-3.23 2.13-4.16l4.63 4.63c.39.39 1.02.39 1.41 0l7.82-7.82c.39-.39.39-1.02 0-1.41l-.26-.26zM15 20c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
  </svg>
);

export const WhistleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M15.5 14h-.79l-1.21-1.21c.98-1.14 1.5-2.61 1.5-4.29C15 4.48 11.52 1 7.5 1S0 4.48 0 8.5c0 3.53 2.47 6.49 5.75 7.24l.95-.95C4.65 14.1 3 11.5 3 8.5 3 6.02 5.02 4 7.5 4s4.5 2.02 4.5 4.5c0 1.33-.58 2.53-1.5 3.34L9.21 13H3v2h12.5c.67 0 1.28-.28 1.71-.72l3.58-3.58c.78-.78.78-2.05 0-2.83l-2.5-2.5c-.78-.78-2.05-.78-2.83 0l-1.76 1.76c.28.32.53.67.73 1.04l.76-.76c.39-.39 1.02-.39 1.41 0l2.5 2.5c.39.39.39 1.02 0 1.41l-3.58 3.58c-.43.43-1.04.72-1.71.72zM5.13 18.87l-1.26 1.26c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.26-1.26c-.39-.4-.63-.9-.63-1.44 0-.55.24-1.05.63-1.44l-1.41-1.41c-1.56 1.56-1.56 4.09 0 5.65z" />
  </svg>
);
