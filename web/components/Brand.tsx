// Brand mark in two forms. Keep in step with app/icon.svg, the source of
// truth for the favicon, home-screen and push icons (scripts/brand-icons.mjs).
//
// LogoMark: transparent rings for inline use next to the wordmark. Ring A
// follows currentColor so it reads on paper, dark surfaces and the footer.
// BrandTile: the full app-icon tile (plum, glowing lens) for hero moments.

import { useId } from "react";

export function LogoMark({
  className = "h-6 w-8 text-brand-700 dark:text-brand-200",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 34 24" aria-hidden className={className} fill="none">
      <defs>
        <linearGradient id="rc-lm-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdba74" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <radialGradient id="rc-lm-lens" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#fff1e0" />
          <stop offset="100%" stopColor="#fdba74" />
        </radialGradient>
      </defs>
      {/* lens: the space both rings share */}
      <path d="M17 5.6 A8.2 8.2 0 0 1 17 18.4 A8.2 8.2 0 0 1 17 5.6 Z" fill="url(#rc-lm-lens)" />
      <circle cx="12.6" cy="12" r="8.2" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="21.4" cy="12" r="8.2" stroke="url(#rc-lm-b)" strokeWidth="2.4" />
      {/* weave: ring A passes over ring B at the top crossing */}
      <path d="M15.4 4.3 A8.2 8.2 0 0 1 18.2 5.9" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function BrandTile({ className = "h-12 w-12" }: { className?: string }) {
  // Stable, unique gradient ids (same on server and client) so several tiles
  // on one page don't collide.
  const id = `rc-tile-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6b3366" />
          <stop offset="0.55" stopColor="#4a2247" />
          <stop offset="1" stopColor="#2a1230" />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="0.22" cy="0.12" r="0.9">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf1fa" />
          <stop offset="1" stopColor="#d9a9d5" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd1a3" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <radialGradient id={`${id}-lens`} cx="0.5" cy="0.38" r="0.75">
          <stop offset="0" stopColor="#fff4e6" />
          <stop offset="0.55" stopColor="#fdba74" />
          <stop offset="1" stopColor="#f97316" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id}-tile)`} />
      <rect width="512" height="512" rx="116" fill={`url(#${id}-sheen)`} />
      <ellipse cx="256" cy="256" rx="92" ry="128" fill="#fb923c" opacity="0.55" filter={`url(#${id}-glow)`} />
      <path d="M256 154.4 A118 118 0 0 1 256 357.6 A118 118 0 0 1 256 154.4 Z" fill={`url(#${id}-lens)`} />
      <g fill="none" strokeWidth="34" strokeLinecap="round">
        <circle cx="196" cy="256" r="118" stroke={`url(#${id}-a)`} />
        <circle cx="316" cy="256" r="118" stroke={`url(#${id}-b)`} />
        <path d="M235.6 144.8 A118 118 0 0 1 274.3 167.8" stroke={`url(#${id}-a)`} strokeLinecap="butt" />
      </g>
      <circle cx="238" cy="206" r="13" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}
