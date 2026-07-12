/** Public pricing display — mirrors PRD §4.1 / seeded `plans` (D42). */
export type MarketingPlan = {
  code: "starter" | "professional" | "premium_ai" | "enterprise";
  priceMonthly: number | null;
  highlighted: boolean;
  limits: {
    doctors: string;
    users: string;
    locations: string;
  };
};

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    code: "starter",
    priceMonthly: 15,
    highlighted: false,
    limits: { doctors: "2", users: "3", locations: "1" },
  },
  {
    code: "professional",
    priceMonthly: 25,
    highlighted: true,
    limits: { doctors: "5", users: "10", locations: "2" },
  },
  {
    code: "premium_ai",
    priceMonthly: 35,
    highlighted: false,
    limits: { doctors: "10", users: "25", locations: "5" },
  },
  {
    code: "enterprise",
    priceMonthly: 60,
    highlighted: false,
    limits: { doctors: "∞", users: "∞", locations: "∞" },
  },
];
