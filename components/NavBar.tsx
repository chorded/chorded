"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/auth/AuthModal";
import { LogOut, User, Music, Library, ChevronDown } from "lucide-react";
import type { LatestRelease } from "@/app/api/latest-release/route";

const FALLBACK_URL =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL ??
  "https://github.com/chorded/chorded/releases/latest";

const SALE_END_DATE = new Date("2026-11-01T01:00:00");

const navLinks = [
  { label: "Chords", href: "/chords" },
  { label: "Features", href: "/#features" },
  { label: "Documentation", href: "/#video" },
  { label: "My Story", href: "/#story" },
  { label: "Pricing", href: "/#pricing" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>(FALLBACK_URL);
  const [isSaleActive, setIsSaleActive] = useState<boolean>(true);

  const isLibraryActive = pathname === "/library" || pathname?.startsWith("/library/");
  const isSetlistActive = pathname === "/mysetlist" || pathname?.startsWith("/mysetlist/");

  useEffect(() => {
    const checkSaleStatus = () => {
      setIsSaleActive(new Date() < SALE_END_DATE);
    };
    checkSaleStatus();
    const interval = setInterval(checkSaleStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/api/latest-release")
      .then((r) => r.json())
      .then((data: LatestRelease) => {
        if (data.downloadUrl) setDownloadUrl(data.downloadUrl);
      })
      .catch(() => {
        // silently keep the fallback URL
      });
  }, []);

  return (
    <>
      <nav className="bg-surface/80 backdrop-blur-md shadow-sm w-full sticky top-0 z-50 border-b border-white/5">
        <div className="flex justify-between items-center px-margin-edge max-w-container-max-width mx-auto h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Image
              src="/icon.png"
              alt="Chorded Logo"
              width={48}
              height={48}
              className="rounded-lg"
            />
            <span className="text-headline-md font-headline-md font-bold text-on-surface tracking-tight">
              CHORDED
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex gap-stack-lg items-center">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="font-label-md text-label-md text-zinc-400 font-medium hover:text-white transition-colors duration-200 flex items-center gap-1.5"
              >
                <span>{link.label}</span>
                {link.label === "Pricing" && isSaleActive && (
                  <span className="text-[10px] font-extrabold uppercase bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full shadow-md shadow-orange-500/25 border border-amber-200/60 inline-flex items-center gap-0.5 leading-none animate-pulse">
                    🔥 Sale
                  </span>
                )}
              </a>
            ))}

            {user && (
              <>
                <Link
                  href="/library"
                  className={`font-label-md text-label-md flex items-center gap-1.5 transition-colors duration-200 ${isLibraryActive
                      ? "text-blue-400 font-semibold"
                      : "text-zinc-400 font-medium hover:text-white"
                    }`}
                >
                  <Library className="w-4 h-4" />
                  My Library
                </Link>
                <Link
                  href="/mysetlist"
                  className={`font-label-md text-label-md flex items-center gap-1.5 transition-colors duration-200 ${isSetlistActive
                      ? "text-blue-400 font-semibold"
                      : "text-zinc-400 font-medium hover:text-white"
                    }`}
                >
                  <Music className="w-4 h-4" />
                  MySetlist
                </Link>
              </>
            )}
          </div>

          {/* Desktop Auth & CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {!authLoading && (
              <>
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs">
                        {profile?.display_name
                          ? profile.display_name.charAt(0).toUpperCase()
                          : user.email?.charAt(0).toUpperCase()}
                      </div>
                      <span className="max-w-[120px] truncate text-xs text-zinc-200">
                        {profile?.display_name || user.email?.split("@")[0]}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    </button>

                    {/* User Dropdown */}
                    {userDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-[#161618] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 text-xs">
                        <div className="px-3.5 py-2 border-b border-white/10">
                          <p className="font-semibold text-white truncate">
                            {profile?.display_name || 'My Account'}
                          </p>
                          <p className="text-zinc-400 truncate">{user.email}</p>
                        </div>

                        <Link
                          href="/library"
                          onClick={() => setUserDropdownOpen(false)}
                          className={`flex items-center gap-2 px-3.5 py-2 hover:bg-white/5 transition-colors ${isLibraryActive
                              ? "text-blue-400 font-semibold bg-blue-500/10"
                              : "text-zinc-300 hover:text-white"
                            }`}
                        >
                          <Library className={`w-3.5 h-3.5 ${isLibraryActive ? "text-blue-400" : "text-zinc-400"}`} />
                          My Library
                        </Link>

                        <Link
                          href="/mysetlist"
                          onClick={() => setUserDropdownOpen(false)}
                          className={`flex items-center gap-2 px-3.5 py-2 hover:bg-white/5 transition-colors ${isSetlistActive
                              ? "text-blue-400 font-semibold bg-blue-500/10"
                              : "text-zinc-300 hover:text-white"
                            }`}
                        >
                          <Music className={`w-3.5 h-3.5 ${isSetlistActive ? "text-blue-400" : "text-zinc-400"}`} />
                          MySetlist
                        </Link>

                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            signOut();
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-red-500/10 text-red-400 text-left cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition duration-200 cursor-pointer"
                  >
                    Sign In
                  </button>
                )}
              </>
            )}

            <a
              href={downloadUrl}
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
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="flex flex-col gap-stack-md px-margin-edge py-stack-md bg-surface border-t border-surface-container-high">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="font-label-md text-label-md text-zinc-400 font-medium hover:text-white transition-colors duration-200 flex items-center justify-between w-full"
              >
                <span>{link.label}</span>
                {link.label === "Pricing" && isSaleActive && (
                  <span className="text-[10px] font-extrabold uppercase bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow-md shadow-orange-500/25 border border-amber-200/60 inline-flex items-center gap-1 leading-none animate-pulse">
                    🔥 Launch Sale $19.99
                  </span>
                )}
              </a>
            ))}

            {user ? (
              <>
                <Link
                  href="/library"
                  onClick={() => setMenuOpen(false)}
                  className={`font-label-md text-label-md flex items-center gap-2 transition-colors duration-200 ${isLibraryActive
                      ? "text-blue-400 font-semibold"
                      : "text-zinc-400 font-medium hover:text-white"
                    }`}
                >
                  <Library className="w-4 h-4" />
                  My Library
                </Link>
                <Link
                  href="/mysetlist"
                  onClick={() => setMenuOpen(false)}
                  className={`font-label-md text-label-md flex items-center gap-2 transition-colors duration-200 ${isSetlistActive
                      ? "text-blue-400 font-semibold"
                      : "text-zinc-400 font-medium hover:text-white"
                    }`}
                >
                  <Music className="w-4 h-4" />
                  MySetlist
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="font-label-md text-label-md text-red-400 hover:text-red-300 flex items-center gap-2 text-left transition-colors duration-200 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out ({user.email})
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setIsAuthModalOpen(true);
                }}
                className="font-label-md text-label-md text-zinc-400 font-medium hover:text-white text-left transition-colors duration-200 cursor-pointer"
              >
                Sign In / Sign Up
              </button>
            )}

            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="custom-button font-label-md text-label-md px-4 py-2 rounded-lg flex items-center gap-2 w-fit"
            >
              Download App
            </a>
          </div>
        </div>
      </nav>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
}
