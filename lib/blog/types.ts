export const BLOG_CATEGORIES = [
  "practice",
  "digitalization",
  "news",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export type BlogFrontmatter = {
  title: string;
  description: string;
  date: string;
  category: BlogCategory;
  author?: string;
  cover?: string;
  draft?: boolean;
};

export type BlogPostMeta = BlogFrontmatter & {
  slug: string;
  locale: string;
  readingMinutes: number;
};

export type BlogPost = BlogPostMeta & {
  content: string;
};

/** W11 — navbar shows Blog only when both locales (or current) have ≥ 2 published posts. */
export const BLOG_NAV_MIN_POSTS = 2;
