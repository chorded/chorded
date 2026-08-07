const GUMROAD_MONTHLY_URL =
  process.env.NEXT_PUBLIC_GUMROAD_MONTHLY_URL ?? "https://gumroad.com";
const GUMROAD_YEARLY_URL =
  process.env.NEXT_PUBLIC_GUMROAD_YEARLY_URL ?? "https://gumroad.com";

interface PlanCardProps {
  badge?: string;
  title: string;
  price: string;
  period: string;
  perMonth?: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
}

function PlanCard({
  badge,
  title,
  price,
  period,
  perMonth,
  description,
  features,
  ctaLabel,
  ctaHref,
  highlighted = false,
}: PlanCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-8 gap-6 transition-transform duration-300 hover:-translate-y-1 ${
        highlighted
          ? "bg-primary-container border-2 border-primary"
          : "bg-surface-container border border-surface-container-high"
      }`}
    >
      {badge && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-on-primary text-xs font-semibold px-4 py-1 rounded-full tracking-wide shadow-lg">
          {badge}
        </span>
      )}

      <div className="flex flex-col gap-2">
        <span
          className={`text-label-md font-semibold tracking-widest uppercase ${
            highlighted ? "text-primary" : "text-secondary"
          }`}
        >
          {title}
        </span>
        <div className="flex items-end gap-1">
          <span className="text-display-lg font-bold text-on-surface">
            {price}
          </span>
          <span className="text-body-md text-on-surface-variant mb-2">
            {period}
          </span>
        </div>
        {perMonth && (
          <span className="text-label-sm text-on-surface-variant">{perMonth}</span>
        )}
        <p className="text-body-md text-on-surface-variant">{description}</p>
      </div>

      <div className="border-t border-outline-variant" />

      <ul className="flex flex-col gap-3 flex-grow">
        {features.map((feat) => (
          <li key={feat} className="flex items-start gap-3">
            <span
              className={`material-symbols-outlined text-base mt-0.5 ${
                highlighted ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              check_circle
            </span>
            <span className="text-body-md text-on-surface">{feat}</span>
          </li>
        ))}
      </ul>

      <a
        href={ctaHref}
        target="_blank"
        rel="noopener noreferrer"
        id={`pricing-cta-${title.toLowerCase().replace(/\s+/g, "-")}`}
        className={`mt-2 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-label-md tracking-wide transition-all duration-200 hover:scale-95 active:scale-100 ${
          highlighted
            ? "bg-primary text-on-primary hover:brightness-110 shadow-lg shadow-primary/30"
            : "custom-button"
        }`}
      >
        <span className="material-symbols-outlined text-base">shopping_cart</span>
        {ctaLabel}
      </a>
    </div>
  );
}

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="w-full py-section-gap bg-surface"
      aria-labelledby="pricing-heading"
    >
      <div className="max-w-container-max-width mx-auto px-margin-edge flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4 text-center max-w-2xl">
          <span className="text-label-md font-semibold tracking-widest uppercase text-primary">
            Pricing
          </span>
          <h2
            id="pricing-heading"
            className="text-headline-lg font-bold text-on-surface"
          >
            Simple, transparent pricing
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            Get full access to CHORDED with a license key. Choose the plan that
            fits your workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          <PlanCard
            title="Monthly"
            price="$5.99"
            period="/ month"
            description="Perfect for trying CHORDED or short-term projects."
            features={[
              "Full access to all features",
              "Software updates during license",
              "Email support",
            ]}
            ctaLabel="Buy 1-Month Key"
            ctaHref={GUMROAD_MONTHLY_URL}
          />

          <PlanCard
            badge="Best Value"
            title="Yearly"
            price="$59"
            period="/ year"
            perMonth="approx. $4.92 / month — save 18%"
            description="Commit to your craft and save with an annual plan."
            features={[
              "Full access to all features",
              "Software updates during license",
              "Priority email support",
              "Lock in today's price",
            ]}
            ctaLabel="Buy 1-Year Key"
            ctaHref={GUMROAD_YEARLY_URL}
            highlighted
          />
        </div>

        <p className="text-label-sm text-on-surface-variant text-center max-w-xl">
          Payments are processed securely via{" "}
          <span className="text-primary font-medium">Gumroad</span>. You will
          receive your license key by email immediately after purchase.
        </p>
      </div>
    </section>
  );
}
