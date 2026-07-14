import { setRequestLocale } from "next-intl/server";
import { BlogHero } from "@/components/marketing/blog/blog-hero";
import { BlogPostGrid } from "@/components/marketing/blog/blog-post-grid";
import { FinalCta } from "@/components/marketing/final-cta";
import { getBlogPosts } from "@/lib/blog/posts";
import { generateMarketingMetadata } from "@/lib/seo/marketing";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateMarketingMetadata(locale, "blog");
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const posts = getBlogPosts(locale);

  return (
    <main className="flex flex-1 flex-col">
      <BlogHero />
      <BlogPostGrid posts={posts} locale={locale} />
      <FinalCta />
    </main>
  );
}
