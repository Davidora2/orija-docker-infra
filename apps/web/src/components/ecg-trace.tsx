export function EcgTrace({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        className="trace-path"
        d="M0 90 H90 L110 90 L125 40 L140 130 L155 70 L170 90 H250 L270 90 L285 20 L300 140 L315 55 L330 90 H430 L450 90 L465 50 L480 120 L495 75 L510 90 H610 L630 90 L645 35 L660 135 L675 60 L690 90 H800"
        stroke="rgba(232,244,241,0.92)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="285" cy="20" r="4" fill="#7ee0cf" className="pulse-dot" />
    </svg>
  );
}
