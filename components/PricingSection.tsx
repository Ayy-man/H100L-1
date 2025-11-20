import * as React from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProgramType = "Group 1x" | "Group 2x" | "Private 1x" | "Private 2x" | "Semi-Private";

interface PricingCardProps {
  title: ProgramType;
  price: string;
  description?: string;
  features: string[];
  cta: string;
  onSelect: () => void;
  featured?: boolean;
}

// SniperZone Hockey Training pricing data
const pricingData: PricingCardProps[] = [
  {
    title: "Group 1x",
    price: "$249.99",
    description: "Perfect for players starting their training journey.",
    features: [
      "1 session per week",
      "7 days/week availability",
      "Small group training (max 6 players)",
      "Age-appropriate skill development",
      "Professional coaching"
    ],
    cta: "Start Training",
    onSelect: () => {},
  },
  {
    title: "Group 2x",
    price: "$399.99",
    description: "Most popular - accelerate your development.",
    features: [
      "2 sessions per week",
      "7 days/week availability",
      "Small group training (max 6 players)",
      "Faster skill progression",
      "Consistent development tracking"
    ],
    cta: "Start Training",
    onSelect: () => {},
    featured: true,
  },
  {
    title: "Private 1x",
    price: "$499.99",
    description: "Personalized one-on-one training.",
    features: [
      "1 private session per week",
      "Fully customized training plan",
      "Individual attention",
      "Flexible scheduling",
      "Targeted skill development"
    ],
    cta: "Start Training",
    onSelect: () => {},
  },
  {
    title: "Private 2x",
    price: "$799.99",
    description: "Elite training for serious athletes.",
    features: [
      "2 private sessions per week",
      "Fully customized training plan",
      "Individual attention",
      "Flexible scheduling",
      "Rapid skill advancement"
    ],
    cta: "Start Training",
    onSelect: () => {},
  },
  {
    title: "Semi-Private",
    price: "$349.99",
    description: "Small group with personalized focus.",
    features: [
      "Monthly training package",
      "2-3 players per session",
      "Personalized attention",
      "Player matching service",
      "Balanced coaching approach"
    ],
    cta: "Start Training",
    onSelect: () => {},
  },
];

interface PricingSectionProps {
  onProgramSelect?: (program: {
    programType: 'group' | 'private' | 'semi-private';
    frequency: '1x' | '2x' | '';
  }) => void;
}

export default function PricingSection({ onProgramSelect }: PricingSectionProps) {
  const handleSelect = (title: ProgramType) => {
    if (!onProgramSelect) return;

    if (title === "Group 1x") {
      onProgramSelect({ programType: 'group', frequency: '1x' });
    } else if (title === "Group 2x") {
      onProgramSelect({ programType: 'group', frequency: '2x' });
    } else if (title === "Private 1x") {
      onProgramSelect({ programType: 'private', frequency: '1x' });
    } else if (title === "Private 2x") {
      onProgramSelect({ programType: 'private', frequency: '2x' });
    } else if (title === "Semi-Private") {
      onProgramSelect({ programType: 'semi-private', frequency: '' });
    }
  };

  // Update the data with the actual handlers
  const updatedPricingData = pricingData.map(plan => ({
    ...plan,
    onSelect: () => handleSelect(plan.title),
  }));

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="flex flex-col items-center gap-4 text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-wider">
            Choose Your Training Program
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl">
            Select the plan that best suits your hockey development goals. All programs include professional coaching and personalized skill development.
          </p>
          <div className="mt-2 text-sm text-[#9BD4FF]">
            💳 Monthly billing • Cancel anytime • CAD pricing
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {updatedPricingData.map((plan) => (
            <PricingCard key={plan.title} plan={plan} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            All prices in CAD. HST applies. Training sessions held at designated ice facilities.
          </p>
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan }: { plan: PricingCardProps }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-white/10 bg-white/5 p-6 text-left backdrop-blur-sm transition-all hover:border-[#9BD4FF]/50 hover:shadow-lg hover:shadow-[#9BD4FF]/10",
        plan.featured && "border-[#9BD4FF] shadow-lg ring-1 ring-[#9BD4FF]/20 scale-105"
      )}
      aria-label={`${plan.title} plan`}
    >
      <div className="text-center">
        <div className="inline-flex items-center gap-2">
          <Badge
            variant={plan.featured ? "default" : "secondary"}
            className={cn(
              plan.featured && "bg-[#9BD4FF] text-black hover:bg-[#9BD4FF]/90"
            )}
          >
            {plan.title}
          </Badge>
          {plan.featured && (
            <span className="rounded-full bg-[#9BD4FF]/20 px-2 py-0.5 text-xs font-medium text-[#9BD4FF] border border-[#9BD4FF]/30">
              Most popular
            </span>
          )}
        </div>
        <h4 className="mb-1 mt-4 text-3xl font-bold text-[#9BD4FF]">
          {plan.price}
        </h4>
        <p className="text-xs text-gray-400">per month</p>
        {plan.description && (
          <p className="mt-3 text-sm text-gray-400">{plan.description}</p>
        )}
      </div>

      <div className="my-6 border-t border-white/10" />

      <ul className="space-y-3 flex-grow">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start text-sm text-gray-300">
            <CircleCheck className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0 text-[#9BD4FF]" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 pt-6 border-t border-white/10">
        <Button
          onClick={plan.onSelect}
          size="sm"
          className={cn(
            "w-full font-bold transition-all",
            plan.featured
              ? "bg-[#9BD4FF] text-black hover:bg-[#9BD4FF]/90 hover:shadow-[0_0_15px_rgba(155,212,255,0.5)]"
              : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
          )}
          variant={plan.featured ? "default" : "secondary"}
        >
          {plan.cta}
        </Button>
      </div>
    </div>
  );
}
