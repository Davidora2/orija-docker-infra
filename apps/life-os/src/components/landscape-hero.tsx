type LandscapeHeroProps = {
  title: string;
  subtitle: string;
  detail: string;
};

export function LandscapeHero({
  title,
  subtitle,
  detail,
}: LandscapeHeroProps) {
  return (
    <div className="relative min-h-48 overflow-hidden rounded-3xl border border-[#d8dfd6] bg-gradient-to-br from-[#eef3ea] via-[#f8f4e9] to-[#e8eef6] px-5 py-6">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full"
        viewBox="0 0 600 140"
        preserveAspectRatio="none"
      >
        <circle cx="505" cy="27" r="13" fill="#f2c66d" opacity="0.72" />
        <path
          d="M0 82 C100 34 178 100 285 67 C405 29 488 87 600 49 L600 140 L0 140 Z"
          fill="#dbe8d7"
        />
        <path
          d="M0 105 C126 63 210 122 345 83 C455 52 525 104 600 77 L600 140 L0 140 Z"
          fill="#b8cdb1"
        />
        <path
          d="M0 124 C142 94 232 135 371 105 C468 83 535 121 600 99 L600 140 L0 140 Z"
          fill="#819b78"
        />
        <path
          d="M42 45 C73 25 108 28 137 48"
          fill="none"
          stroke="#617a57"
          strokeLinecap="round"
          strokeWidth="3"
          opacity="0.42"
        />
      </svg>
      <div className="relative max-w-xl space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#617a57]">
          Life OS · Plan
        </p>
        <h1 className="font-serif text-4xl text-[#14241f]">{title}</h1>
        <p className="text-lg font-medium text-[#24362f]">{subtitle}</p>
        <p className="max-w-lg text-sm leading-relaxed text-[#5f6d66]">{detail}</p>
      </div>
    </div>
  );
}
