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
    title: 'Politique et Code d\'éthique',
    lastUpdated: 'Hockey100Limites - SniperZone',
    sections: [
      {
        title: '1. Mission et Objectifs',
        content: 'La mission de Hockey100Limites est de promouvoir le hockey comme un sport amusant, inclusif et respectueux pour tous les participants. Nos objectifs incluent le développement des compétences, la promotion de l\'esprit sportif et le renforcement des valeurs positives chez les joueurs et les parents.'
      },
      {
        title: '2. Respect et Fair-play',
        content: 'Nous valorisons le respect de soi-même, des coéquipiers, des adversaires et des règles du jeu. Nous encourageons le fair-play et la tolérance zéro envers le comportement antisportif, la tricherie ou les jeux dangereux.'
      },
      {
        title: '3. Développement des joueurs',
        content: 'Nous nous engageons à fournir un environnement d\'apprentissage positif où les joueurs peuvent développer leurs compétences, leur confiance et leur amour pour le jeu. Les entraîneurs sont encouragés à être des modèles positifs et à encourager la croissance personnelle et sportive de chaque joueur.'
      },
      {
        title: '4. Communication et Transparence',
        content: 'Nous nous engageons à communiquer de manière transparente avec les joueurs, les parents et les entraîneurs sur les attentes, les règles et les politiques du programme. Toutes les décisions importantes seront communiquées de manière claire et opportune.'
      },
      {
        title: '5. Engagement Communautaire',
        content: 'Nous encourageons l\'engagement des joueurs, des entraîneurs et des parents dans la communauté locale en participant à des événements et à des activités de bénévolat. Nous cherchons à établir des partenariats positifs avec d\'autres organisations et à contribuer positivement à la vie communautaire.'
      },
      {
        title: '6. Responsabilité et Discipline',
        content: 'Tous les participants sont responsables de leur comportement sur et en dehors de la glace. Les violations du code d\'éthique peuvent entraîner des mesures disciplinaires, y compris la suspension ou l\'expulsion du programme. Les plaintes ou les préoccupations doivent être signalées au comité de gestion pour examen et action appropriée.'
      },
      {
        title: '7. Processus d\'inscription',
        content: 'Les inscriptions au camp de hockey doivent être effectuées en ligne via notre site web officiel ou en contactant l\'école. Les participants doivent remplir un formulaire d\'inscription complet, y compris les informations personnelles, les détails médicaux et les autorisations parentales.'
      },
      {
        title: '8. Critères d\'admissibilité',
        content: 'Le camp de hockey est ouvert aux joueurs et joueuses de tous niveaux de compétence, âgés de 5 ans à adultes.'
      },
      {
        title: '9. Dates et tarifs',
        content: 'Les dates, les horaires et les tarifs du camp de hockey sont publiés sur notre site web et peuvent varier en fonction de la durée du camp et des options choisies. Des réductions peuvent être offertes pour les inscriptions anticipées ou les inscriptions de plusieurs séances.'
      },
      {
        title: '10. Politique de Paiement',
        content: 'Un paiement de 50% doit être effectué au moment de l\'inscription avant la première pratique pour séance ou le mois(semaine) est requis pour garantir la place du participant au camp. Le paiement complet de l\'inscription doit être effectué lors de la première séance, sauf accord préalable entre l\'école et le client. Les paiements peuvent être effectués en ligne par carte débit, par virement bancaire ou argent comptant.'
      },
      {
        title: '11. Politique de Remboursement',
        content: 'Les demandes de remboursement doivent être soumises par écrit avant la date limite d\'annulation spécifiée. Toute annulation de participation doit être effectuée au minimum 72 heures avant la séance. Toute annulation effectuée après le délai de 72 heures entraînera l\'imposition d\'un montant de 25% du prix total de la séance ou de la session complète.'
      },
      {
        title: '12. Annulation ou Modification du Camp',
        content: 'En cas d\'annulation ou de modification du camp de hockey en raison de circonstances imprévues, les participants seront informés dès que possible et des arrangements seront pris pour un remboursement ou un report des frais d\'inscription.'
      },
      {
        title: '13. Documents Requis',
        content: 'Avant le début du camp, les participants doivent fournir une preuve d\'assurance médicale et un formulaire d\'autorisation parentale signé.'
      },
      {
        title: '14. Politique de Confidentialité',
        content: 'Les informations personnelles des participants seront traitées conformément à notre politique de confidentialité et ne seront pas partagées avec des tiers sans autorisation.'
      },
      {
        title: '15. Politique de discipline',
        content: 'Tout manque de respect verbal ou physique envers les participants ou les membres du personnel ne sera pas accepté et peut entraîner l\'expulsion immédiate de notre programme sans aucun remboursement. Aucun langage ou comportement à caractère raciste, sexiste ou discriminatoire ne sera toléré. Toute action de vandalisme envers les établissements et les équipements utilisés par Hockey100limites sera facturée au participant ou aux parents du participant (si mineur).'
      },
      {
        title: '16. Politique de sécurité',
        content: 'Équipement de protection: Tous les participants doivent porter un équipement de protection complet, y compris un casque et des gants. Protocoles d\'urgence: Des protocoles d\'urgence clairs seront en place en cas d\'accident ou de blessure grave, y compris l\'accès immédiat aux services médicaux d\'urgence. Communication des risques: Les participants et leurs parents seront informés des risques associés à la pratique du hockey et des mesures prises pour les minimiser. Supervision adéquate: Un ratio adéquat d\'entraîneurs et de personnel de soutien sera maintenu pour assurer une supervision appropriée des participants. Communication en cas d\'urgence: Un plan de communication d\'urgence sera en place pour informer rapidement les parents en cas d\'accident ou de situation d\'urgence impliquant leur enfant. Contrôle d\'identité à la sortie: Une pièce d\'identité sera demandée chaque jour au parent ou au tuteur légal venant chercher l\'enfant afin d\'assurer sa sécurité.'
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
