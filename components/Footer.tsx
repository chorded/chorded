const footerLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Support", href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-surface-container w-full py-stack-lg border-t border-surface-container-high">
      <div className="flex flex-col md:flex-row justify-between items-center px-margin-edge max-w-container-max-width mx-auto gap-stack-md">
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <span className="text-headline-md font-headline-md font-bold text-on-surface">
            Chorded
          </span>
          <span className="font-label-sm text-label-sm text-secondary">
            © 2026 Chorded. Precision-crafted for musicians.
          </span>
        </div>

        {/* Links */}
        <div className="flex gap-stack-md">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
