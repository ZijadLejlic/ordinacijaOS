/** FAQ categories and item keys — Website-DentOrd §4.7. */

export const FAQ_CATEGORIES = [
  {
    key: "gettingStarted",
    items: ["register", "setup", "import", "education"] as const,
  },
  {
    key: "pricing",
    items: ["free", "card", "billing", "cancel"] as const,
  },
  {
    key: "security",
    items: ["storage", "visibility", "backup", "delete", "export"] as const,
  },
  {
    key: "usage",
    items: ["mobile", "users", "locations", "invite"] as const,
  },
] as const;

export type FaqCategoryKey = (typeof FAQ_CATEGORIES)[number]["key"];
