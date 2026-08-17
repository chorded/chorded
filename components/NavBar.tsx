"use client";

import { useState } from "react";
import Image from "next/image";

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? "#";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Documentation", href: "#docs" },
  { label: "Pricing", href: "#pricing" },
];

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-surface/80 backdrop-blur-md shadow-sm w-full sticky top-0 z-50">
      <div className="flex justify-between items-center px-margin-edge max-w-container-max-width mx-auto h-24">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image
            src="/icon.png"
            alt="Chorded Logo"
            width={60}
            height={60}
            className="rounded-lg"
          />
          <span className="text-headline-md font-headline-md font-bold text-on-surface">
            CHORDED
          </span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex gap-stack-lg items-center">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-label-md text-label-md text-on-surface-variant font-medium hover:text-primary transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop download CTA */}
        <div className="hidden md:block">
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="custom-button font-label-md text-label-md px-4 py-2 rounded-lg flex items-center gap-2 hover:scale-95 transition-transform"
          >
            Download
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span
            className={`block w-6 h-0.5 bg-on-surface transition-transform duration-200 ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            className={`block w-6 h-0.5 bg-on-surface transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-6 h-0.5 bg-on-surface transition-transform duration-200 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </div>

      {/* Mobile slide-down drawer */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="flex flex-col gap-stack-md px-margin-edge py-stack-md bg-surface border-t border-surface-container-high">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="custom-button font-label-md text-label-md px-4 py-2 rounded-lg flex items-center gap-2 w-fit"
          >
            Download
          </a>
        </div>
      </div>
    </nav>
  );
}
