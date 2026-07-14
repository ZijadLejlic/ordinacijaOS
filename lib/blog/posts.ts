import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  BLOG_CATEGORIES,
  BLOG_NAV_MIN_POSTS,
  type BlogCategory,
  type BlogFrontmatter,
  type BlogPost,
  type BlogPostMeta,
} from "@/lib/blog/types";
import type { AppLocale } from "@/i18n/routing";

const CONTENT_ROOT = path.join(process.cwd(), "content/blog");

function localeDir(locale: string) {
  return path.join(CONTENT_ROOT, locale);
}

function isCategory(value: unknown): value is BlogCategory {
  return (
    typeof value === "string" &&
    (BLOG_CATEGORIES as readonly string[]).includes(value)
  );
}

function readingMinutes(body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function parsePost(locale: string, filename: string): BlogPost | null {
  if (!filename.endsWith(".mdx") && !filename.endsWith(".md")) return null;
  const slug = filename.replace(/\.mdx?$/, "");
  const raw = fs.readFileSync(path.join(localeDir(locale), filename), "utf8");
  const { data, content } = matter(raw);
  const fm = data as Partial<BlogFrontmatter>;

  if (!fm.title || !fm.description || !fm.date || !isCategory(fm.category)) {
    return null;
  }
  if (fm.draft) return null;

  return {
    slug,
    locale,
    title: fm.title,
    description: fm.description,
    date: fm.date,
    category: fm.category,
    author: fm.author,
    cover: fm.cover,
    draft: false,
    content,
    readingMinutes: readingMinutes(content),
  };
}

/** Published posts for a locale, newest first. */
export function getBlogPosts(locale: string): BlogPostMeta[] {
  const dir = localeDir(locale);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .map((file) => parsePost(locale, file))
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ content: _content, ...meta }) => meta);
}

export function getBlogPost(
  locale: string,
  slug: string,
): BlogPost | null {
  const dir = localeDir(locale);
  for (const ext of [".mdx", ".md"] as const) {
    const file = `${slug}${ext}`;
    if (fs.existsSync(path.join(dir, file))) {
      return parsePost(locale, file);
    }
  }
  return null;
}

export function getBlogSlugs(locale: string): string[] {
  return getBlogPosts(locale).map((p) => p.slug);
}

/** W11 — show Blog in navbar only when there are enough published articles. */
export function shouldShowBlogInNav(locale: AppLocale): boolean {
  return getBlogPosts(locale).length >= BLOG_NAV_MIN_POSTS;
}
