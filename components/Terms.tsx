import React from 'react';
import { Language } from '../types';

interface TermsProps {
  language: Language;
  onClose: () => void;
}

const termsContent = {
  en: {
    title: 'Terms & Conditions',
    lastUpdated: 'Last Updated: November 2025',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: 'By registering for SniperZone Hockey Training programs, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not complete the registration process.'
      },
      {
        title: '2. Program Registration',
        content: 'Registration is subject to availability and capacity limits. Payment must be completed at the time of registration. All fees are non-refundable unless otherwise specified.'
      },
      {
        title: '3. Payment Terms',
        content: 'Payment is processed securely through Stripe. By providing payment information, you authorize SniperZone to charge the applicable fees for the selected program. Subscription-based programs will be charged on a recurring basis until cancelled.'
      },
      {
        title: '4. Cancellation & Refund Policy',
        content: '[PLACEHOLDER - Add your specific cancellation and refund policies here. Include notice periods, refund amounts, and any applicable conditions.]'
      },
      {
        title: '5. Participant Safety & Liability',
        content: '[PLACEHOLDER - Add liability waiver, assumption of risk, medical emergency authorization, and insurance requirements here.]'
      },
      {
        title: '6. Code of Conduct',
        content: '[PLACEHOLDER - Add expected behavior for participants, parents, and spectators. Include disciplinary procedures and grounds for program removal.]'
      },
      {
        title: '7. Photo & Video Consent',
        content: 'If you have provided consent, SniperZone may use photographs and videos taken during training sessions for promotional purposes including website, social media, and marketing materials.'
      },
      {
        title: '8. Privacy Policy',
        content: 'Your personal information is collected and stored securely. We do not share your information with third parties except as necessary to provide our services (e.g., payment processing). You have the right to request access to, correction of, or deletion of your personal data.'
      },
      {
        title: '9. Schedule Changes',
        content: '[PLACEHOLDER - Add policies regarding schedule modifications, weather cancellations, facility closures, and makeup sessions.]'
      },
      {
        title: '10. Contact Information',
        content: 'For questions regarding these terms, please contact SniperZone Hockey Training at [EMAIL ADDRESS] or [PHONE NUMBER].'
      }
    ]
  },
  fr: {
    title: 'Termes et Conditions',
    lastUpdated: 'Dernière mise à jour: Novembre 2025',
    sections: [
      {
        title: '1. Acceptation des Conditions',
        content: 'En vous inscrivant aux programmes d\'entraînement SniperZone Hockey, vous acceptez d\'être lié par ces Termes et Conditions. Si vous n\'acceptez pas ces conditions, veuillez ne pas compléter le processus d\'inscription.'
      },
      {
        title: '2. Inscription au Programme',
        content: 'L\'inscription est sujette à la disponibilité et aux limites de capacité. Le paiement doit être complété au moment de l\'inscription. Tous les frais sont non remboursables sauf indication contraire.'
      },
      {
        title: '3. Conditions de Paiement',
        content: 'Le paiement est traité en toute sécurité via Stripe. En fournissant vos informations de paiement, vous autorisez SniperZone à facturer les frais applicables pour le programme sélectionné. Les programmes par abonnement seront facturés de façon récurrente jusqu\'à l\'annulation.'
      },
      {
        title: '4. Politique d\'Annulation et de Remboursement',
        content: '[PLACEHOLDER - Ajoutez vos politiques spécifiques d\'annulation et de remboursement ici. Incluez les délais de préavis, les montants de remboursement et toutes conditions applicables.]'
      },
      {
        title: '5. Sécurité des Participants et Responsabilité',
        content: '[PLACEHOLDER - Ajoutez la décharge de responsabilité, l\'acceptation des risques, l\'autorisation d\'urgence médicale et les exigences d\'assurance ici.]'
      },
      {
        title: '6. Code de Conduite',
        content: '[PLACEHOLDER - Ajoutez le comportement attendu pour les participants, parents et spectateurs. Incluez les procédures disciplinaires et les motifs de retrait du programme.]'
      },
      {
        title: '7. Consentement Photo et Vidéo',
        content: 'Si vous avez donné votre consentement, SniperZone peut utiliser des photographies et vidéos prises lors des sessions d\'entraînement à des fins promotionnelles incluant le site web, les réseaux sociaux et le matériel marketing.'
      },
      {
        title: '8. Politique de Confidentialité',
        content: 'Vos informations personnelles sont collectées et stockées en toute sécurité. Nous ne partageons pas vos informations avec des tiers sauf si nécessaire pour fournir nos services (ex: traitement des paiements). Vous avez le droit de demander l\'accès, la correction ou la suppression de vos données personnelles.'
      },
      {
        title: '9. Changements d\'Horaire',
        content: '[PLACEHOLDER - Ajoutez les politiques concernant les modifications d\'horaire, les annulations dues aux conditions météo, les fermetures d\'installations et les sessions de rattrapage.]'
      },
      {
        title: '10. Coordonnées',
        content: 'Pour toute question concernant ces conditions, veuillez contacter SniperZone Hockey Training au [ADRESSE COURRIEL] ou [NUMÉRO DE TÉLÉPHONE].'
      }
    ]
  }
};

const Terms: React.FC<TermsProps> = ({ language, onClose }) => {
  const content = termsContent[language];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-wider text-[#9BD4FF]">
              {content.title}
            </h1>
            <p className="text-gray-400 mt-2">{content.lastUpdated}</p>
          </div>
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition-all font-bold"
          >
            {language === 'en' ? 'Close' : 'Fermer'}
          </button>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {content.sections.map((section, index) => (
            <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-[#9BD4FF] mb-4">
                {section.title}
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            {language === 'en'
              ? 'By continuing with registration, you acknowledge that you have read and agree to these Terms and Conditions.'
              : 'En continuant l\'inscription, vous reconnaissez avoir lu et accepté ces Termes et Conditions.'}
          </p>
          <button
            onClick={onClose}
            className="mt-6 bg-[#9BD4FF] text-black px-8 py-4 rounded-lg font-bold hover:shadow-[0_0_15px_#9BD4FF] transition-all"
          >
            {language === 'en' ? 'Back to Registration' : 'Retour à l\'Inscription'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Terms;
