import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";

const mdxComponents = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="mt-10 scroll-mt-28 font-[family-name:var(--font-marketing-display)] text-2xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)]"
      {...props}
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="mt-8 scroll-mt-28 font-[family-name:var(--font-marketing-display)] text-xl font-semibold tracking-[-0.02em] text-[var(--marketing-ink)]"
      {...props}
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className="mt-4 text-base leading-relaxed text-[color-mix(in_oklab,var(--marketing-ink)_80%,transparent)]"
      {...props}
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-base" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-base" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="font-medium text-[var(--marketing-accent)] underline-offset-2 hover:underline"
      {...props}
    />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-[var(--marketing-ink)]" {...props} />
  ),
};

export async function renderBlogMdx(source: string): Promise<ReactNode> {
  const { content } = await compileMDX({
    source,
    components: mdxComponents,
  });
  return content;
}
