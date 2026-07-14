import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/marketing/reveal";
import type { BlogPostMeta } from "@/lib/blog/types";

type BlogPostGridProps = {
  posts: BlogPostMeta[];
  locale: string;
};

export async function BlogPostGrid({ posts, locale }: BlogPostGridProps) {
  const t = await getTranslations("Marketing.blog");

  if (posts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-16 md:px-8 md:pb-24">
        <div className="rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-wash)] px-6 py-14 text-center">
          <p className="font-[family-name:var(--font-marketing-display)] text-2xl font-semibold text-[var(--marketing-ink)]">
            {t("empty.title")}
          </p>
          <p className="mx-auto mt-3 max-w-md text-base text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)]">
            {t("empty.body")}
          </p>
        </div>
      </div>
    );
  }

  const dateLocale = locale === "en" ? "en-GB" : "bs-BA";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-16 md:px-8 md:pb-24">
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, index) => (
          <li key={post.slug}>
            <Reveal delayMs={index * 60}>
              <Link
                href={{
                  pathname: "/blog/[slug]",
                  params: { slug: post.slug },
                }}
                className="group flex h-full flex-col rounded-2xl border border-[var(--marketing-mist)] bg-[var(--marketing-surface)] p-5 transition-transform duration-150 hover:-translate-y-[3px]"
              >
                <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--marketing-accent)]">
                  {t(`categories.${post.category}`)}
                </span>
                <h2 className="mt-3 font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)] group-hover:text-[var(--marketing-accent)]">
                  {post.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_70%,transparent)]">
                  {post.description}
                </p>
                <p className="mt-4 text-xs text-[color-mix(in_oklab,var(--marketing-ink)_50%,transparent)]">
                  {new Date(post.date).toLocaleDateString(dateLocale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  {t("readingTime", { minutes: post.readingMinutes })}
                </p>
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}
