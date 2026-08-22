export function HeroHills({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-90 ${className}`}
      viewBox="0 0 600 140"
      preserveAspectRatio="none"
    >
      <circle cx="505" cy="27" r="13" fill="#d6f57a" opacity="0.22" />
      <path
        d="M0 82 C100 34 178 100 285 67 C405 29 488 87 600 49 L600 140 L0 140 Z"
        fill="#1e4a38"
        opacity="0.72"
      />
      <path
        d="M0 105 C126 63 210 122 345 83 C455 52 525 104 600 77 L600 140 L0 140 Z"
        fill="#163a2c"
        opacity="0.82"
      />
      <path
        d="M0 124 C142 94 232 135 371 105 C468 83 535 121 600 99 L600 140 L0 140 Z"
        fill="#0f2920"
        opacity="0.92"
      />
      <path
        d="M42 45 C73 25 108 28 137 48"
        fill="none"
        stroke="#8fb38a"
        strokeLinecap="round"
        strokeWidth="3"
        opacity="0.28"
      />
    </svg>
  );
}
