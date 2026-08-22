type LandscapeHeroProps = {
  title: string;
  subtitle: string;
  detail: string;
  eyebrow?: string;
};

export function LandscapeHero({
  title,
  subtitle,
  detail,
  eyebrow = "Life OS · Plan",
}: LandscapeHeroProps) {
  return (
    <div
      className="relative min-h-[11.25rem] overflow-hidden rounded-3xl border border-[#203b31] px-5 py-5 shadow-[0_18px_50px_rgba(20,36,31,0.14)]"
      style={{
        background:
          "radial-gradient(circle at 96% 8%, rgba(214, 245, 122, 0.18), transparent 35%), linear-gradient(145deg, #17332a, #10251f)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-[#d6f57a]/13"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-[4.5rem] h-48 w-48 rounded-full border border-[#d6f57a]/8"
      />

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full opacity-90"
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

      <div className="relative z-[1] max-w-xl space-y-1.5">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d6f57a]" />
          {eyebrow}
        </p>
        <h1 className="font-serif text-3xl leading-tight tracking-tight text-white sm:text-[2rem]">
          {title}
        </h1>
        <p className="text-base font-medium text-white/72">{subtitle}</p>
        <p className="max-w-lg text-sm leading-relaxed text-white/55">{detail}</p>
      </div>
    </div>
  );
}
