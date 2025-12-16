import * as React from "react";
import { CircleCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PackageType = "single" | "10_pack" | "20_pack" | "50_pack" | "sunday" | "semi_private" | "private";

interface PricingCardProps {
  title: string;
  price: string;
  perSession?: string;
  description?: string;
  features: string[];
  cta: string;
  onSelect: () => void;
  featured?: boolean;
  badge?: string;
}

// SniperZone Credit-Based Pricing (December 2025)
const pricingData: PricingCardProps[] = [
  {
    title: "Single Session",
    price: "$45",
    description: "Perfect for trying out our training.",
    features: [
      "1 group training credit",
      "Valid for 12 months",
      "Book any available slot",
      "Professional coaching",
    ],
    cta: "Buy 1 Credit",
    onSelect: () => {},
  },
  {
    title: "10-Session Pack",
    price: "$350",
    perSession: "$35/session",
    description: "Great value for regular training.",
    features: [
      "10 group training credits",
      "Save $100 vs single sessions",
      "Valid for 12 months",
      "Best for weekly training",
    ],
    cta: "Buy 10 Credits",
    onSelect: () => {},
  },
  {
    title: "20-Session Pack",
    price: "$500",
    perSession: "$25/session",
    description: "Great for committed players.",
    features: [
      "20 group training credits",
      "Save $400 vs single sessions",
      "Valid for 12 months",
      "Best for 2x/week training",
    ],
    cta: "Buy 20 Credits",
    onSelect: () => {},
    badge: "Popular",
  },
  {
    title: "50-Session Pack",
    price: "$1,000",
    perSession: "$20/session",
    description: "Maximum savings for serious athletes.",
    features: [
      "50 group training credits",
      "Save $1,250 vs single sessions",
      "Valid for 12 months",
      "Best for multi-child families",
    ],
    cta: "Buy 50 Credits",
    onSelect: () => {},
    featured: true,
    badge: "Best Value",
  },
  {
    title: "Sunday Ice",
    price: "$50",
    description: "Real ice practice session.",
    features: [
      "1 Sunday ice session",
      "Real ice practice",
      "Game preparation",
      "Pay per session",
    ],
    cta: "Book Session",
    onSelect: () => {},
  },
  {
    title: "Semi-Private",
    price: "$69",
    description: "Small group training (2-3 players).",
    features: [
      "Matched by skill & age",
      "Personal attention",
      "Flexible scheduling",
      "Pay per session",
    ],
    cta: "Book Session",
    onSelect: () => {},
  },
  {
    title: "Private",
    price: "$89.99",
    description: "One-on-one coaching.",
    features: [
      "Dedicated 1-on-1 coaching",
      "Customized training plan",
      "Video analysis",
      "Pay per session",
    ],
    cta: "Book Session",
    onSelect: () => {},
  },
];

interface PricingSectionProps {
  onPackageSelect?: (packageType: PackageType) => void;
}

export default function PricingSection({ onPackageSelect }: PricingSectionProps) {
  const handleSelect = (title: string) => {
    if (!onPackageSelect) return;

    const packageMap: Record<string, PackageType> = {
      "Single Session": "single",
      "10-Session Pack": "10_pack",
      "20-Session Pack": "20_pack",
      "50-Session Pack": "50_pack",
      "Sunday Ice": "sunday",
      "Semi-Private": "semi_private",
      "Private": "private",
    };

    const packageType = packageMap[title];
    if (packageType) {
      onPackageSelect(packageType);
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
            Session Packages
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl">
            Buy credits for group training or book individual sessions. Credits are shared across all your children.
          </p>
          <div className="mt-2 text-sm text-[#9BD4FF]">
            No subscriptions - Pay per session - Credits valid 12 months
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {updatedPricingData.map((plan) => (
            <PricingCard key={plan.title} plan={plan} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            All prices in CAD. HST applies. No refunds on credit purchases.
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
          {plan.badge && (
            <span className="rounded-full bg-[#9BD4FF]/20 px-2 py-0.5 text-xs font-medium text-[#9BD4FF] border border-[#9BD4FF]/30 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {plan.badge}
            </span>
          )}
        </div>
        <h4 className="mb-1 mt-4 text-3xl font-bold text-[#9BD4FF]">
          {plan.price}
        </h4>
        {plan.perSession && (
          <p className="text-xs text-green-400">{plan.perSession}</p>
        )}
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
