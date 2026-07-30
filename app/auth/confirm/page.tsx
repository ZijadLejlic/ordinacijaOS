import Link from "next/link";

type Props = {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
};

/**
 * Intermediate click step for recovery/invite emails.
 * Prevents Gmail/Safe Links prefetch from consuming the one-time token.
 */
export default async function AuthConfirmPage({ searchParams }: Props) {
  const params = await searchParams;
  const tokenHash = params.token_hash?.trim() ?? "";
  const type = params.type?.trim() ?? "";
  const next = params.next?.trim() || "/bs/login";

  const callbackQs = new URLSearchParams();
  if (tokenHash) callbackQs.set("token_hash", tokenHash);
  if (type) callbackQs.set("type", type);
  callbackQs.set("next", next.startsWith("/") ? next : `/${next}`);
  const href = `/auth/callback?${callbackQs.toString()}`;
  const valid = Boolean(tokenHash && type);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        background: "#F5FAFF",
        color: "#0F1B3D",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #dbe7f5",
          borderRadius: 12,
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.35rem", margin: "0 0 0.5rem" }}>
          DentOrd — potvrda
        </h1>
        {valid ? (
          <>
            <p style={{ margin: "0 0 1.5rem", lineHeight: 1.5, color: "#334155" }}>
              Klikni dugme ispod da nastaviš na postavljanje nove lozinke.
            </p>
            <Link
              href={href}
              style={{
                display: "inline-block",
                background: "#0B6EF5",
                color: "#fff",
                textDecoration: "none",
                padding: "0.75rem 1.1rem",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Nastavi
            </Link>
          </>
        ) : (
          <p style={{ margin: 0, lineHeight: 1.5, color: "#334155" }}>
            Link nije važeći ili je istekao. Zatraži novi reset lozinke.
          </p>
        )}
      </div>
    </main>
  );
}
