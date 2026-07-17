/**
 * MnemoResto mark: a service cloche whose handle is an infinity symbol —
 * memory (Mnemosyne ∞) over the plate. Inline SVG so it ships crisp at any
 * size with the brand gradient, no asset pipeline involved.
 */
export function MnemoRestoLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="mnr-grad" x1="6" y1="42" x2="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {/* infinity handle */}
      <path
        d="M24 9 C21.5 5.8 17.2 5.8 17.2 9 C17.2 12.2 21.5 12.2 24 9 C26.5 5.8 30.8 5.8 30.8 9 C30.8 12.2 26.5 12.2 24 9 Z"
        stroke="url(#mnr-grad)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* cloche dome */}
      <path
        d="M9 33 C9 22.5 15.5 15 24 15 C32.5 15 39 22.5 39 33 Z"
        fill="url(#mnr-grad)"
        fillOpacity="0.16"
        stroke="url(#mnr-grad)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* serving plate */}
      <rect x="5" y="35.5" width="38" height="4" rx="2" fill="url(#mnr-grad)" />
    </svg>
  );
}
