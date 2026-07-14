import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FinalCta } from "@/components/marketing/final-cta";
import { getPathname, Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { renderBlogMdx } from "@/lib/blog/mdx";
import { getBlogPost, getBlogPosts, getBlogSlugs } from "@/lib/blog/posts";
import { PRODUCT_URL } from "@/lib/brand/constants";
import { articleJsonLd, JsonLd } from "@/lib/seo/json-ld";
import { buildMarketingMetadata } from "@/lib/seo/metadata";
import { marketingOgImagePath } from "@/lib/seo/og";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getBlogSlugs(locale).map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const post = getBlogPost(locale, slug);
  if (!post) return {};

  return buildMarketingMetadata({
    locale,
    pathname: "/blog/[slug]",
    params: { slug },
    title: `${post.title} — DentOrd`,
    description: post.description,
    ogImage: marketingOgImagePath(post.title),
  });
}

export default async function BlogArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = getBlogPost(locale, slug);
  if (!post) notFound();

  const t = await getTranslations("Marketing.blog");
  const body = await renderBlogMdx(post.content);
  const related = getBlogPosts(locale)
    .filter((p) => p.slug !== slug)
    .slice(0, 3);

  const articlePath = getPathname({
    locale: locale as AppLocale,
    href: { pathname: "/blog/[slug]", params: { slug } },
  });
  const dateLocale = locale === "en" ? "en-GB" : "bs-BA";

  return (
    <main className="flex flex-1 flex-col">
      <JsonLd
        data={articleJsonLd({
          headline: post.title,
          description: post.description,
          url: `${PRODUCT_URL}${articlePath}`,
          datePublished: post.date,
          locale,
        })}
      />
      <article className="mx-auto w-full max-w-[720px] px-6 py-12 md:px-8 md:py-16">
        <Link
          href="/blog"
          className="text-sm font-medium text-[var(--marketing-accent)] hover:underline"
        >
          ← {t("backToIndex")}
        </Link>
        <p className="mt-6 text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
          {t(`categories.${post.category}`)}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-marketing-display)] text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] md:text-[3rem]">
          {post.title}
        </h1>
        <p className="mt-4 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_68%,transparent)]">
          {new Date(post.date).toLocaleDateString(dateLocale, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {" · "}
          {t("readingTime", { minutes: post.readingMinutes })}
          {post.author ? ` · ${post.author}` : null}
        </p>
        <p className="mt-6 text-lg leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_75%,transparent)]">
          {post.description}
        </p>
        <div className="prose-blog mt-10">{body}</div>
      </article>

      {related.length > 0 ? (
        <section className="border-t border-[var(--marketing-mist)] bg-[var(--marketing-wash)] py-14">
          <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
            <h2 className="font-[family-name:var(--font-marketing-display)] text-2xl font-semibold text-[var(--marketing-ink)]">
              {t("related")}
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={{
                      pathname: "/blog/[slug]",
                      params: { slug: item.slug },
                    }}
                    className="block rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)] p-5 transition-colors hover:border-[var(--marketing-accent)]"
                  >
                    <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
                      {t(`categories.${item.category}`)}
                    </span>
                    <span className="mt-2 block font-medium text-[var(--marketing-ink)]">
                      {item.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <FinalCta />
    </main>
  );
}
