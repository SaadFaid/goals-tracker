import Brand from "../components/Brand";
import CookieBanner from "../components/CookieBanner";
import { BRAND, LEGAL_PAGES, legalPage } from "../lib/brand";

const go = (path) => {
  window.location.hash = path;
};

/**
 * The four legal pages. Short, plain sentences — the point of a legal page is
 * that someone can actually read it.
 */
export default function Legal({ id }) {
  const page = legalPage(id) || LEGAL_PAGES[0];

  return (
    <main className="min-h-screen" style={{ background: "var(--color-base)" }}>
      <header className="sticky top-0 z-40 nav-blur">
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button type="button" onClick={() => go("/")} aria-label={`${BRAND.name} home`}>
            <Brand size="sm" />
          </button>
          <button
            type="button"
            onClick={() => go("/")}
            className="text-[12px] cursor-pointer hover:underline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Back to the site
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-4 sm:px-6 py-12">
        <nav className="flex flex-wrap gap-2 mb-8" aria-label="Legal pages">
          {LEGAL_PAGES.map((p) => {
            const active = p.id === page.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => go(`/legal/${p.id}`)}
                aria-current={active ? "page" : undefined}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer transition-colors capitalize"
                style={{
                  background: active ? "var(--color-accent-muted)" : "transparent",
                  border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                  color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
                }}
              >
                {p.title}
              </button>
            );
          })}
        </nav>

        <h1 className="h1 text-heading" style={{ fontSize: 30, letterSpacing: "-0.02em" }}>
          {page.title}
        </h1>
        <p className="text-sm text-muted mt-2 mb-8">{page.intro}</p>

        <div className="flex flex-col gap-6">
          {page.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="h3 text-heading" style={{ fontSize: 15 }}>
                {s.heading}
              </h2>
              <p className="text-sm text-muted mt-1.5 leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>

        <p className="text-[11px] text-text-tertiary mt-10">
          Questions about this page? Email {BRAND.supportEmail}.
        </p>
      </div>

      <footer className="px-4 sm:px-6 py-8" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div className="mx-auto max-w-[720px] flex items-center justify-between gap-3">
          <span className="text-[12px] text-text-tertiary">
            {BRAND.name} · © {BRAND.year}
          </span>
          <button
            type="button"
            onClick={() => go("/")}
            className="text-[12px] text-text-tertiary hover:text-heading transition-colors cursor-pointer"
          >
            Back to the site
          </button>
        </div>
      </footer>

      <CookieBanner />
    </main>
  );
}
