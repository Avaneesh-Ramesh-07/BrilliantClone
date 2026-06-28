/**
 * A small running ninja figure used by the home learning path animation. The
 * torso + head are static; two limb "pose" groups (.ninja-stride-a /
 * .ninja-stride-b) flip-book back and forth so the legs and arms pump like a
 * running cycle while the figure travels along the dotted path. The travel and
 * bob are applied by the parent (LessonPath) via a wrapping element.
 */
export function RunningNinja() {
  return (
    <svg viewBox="0 0 40 52" className="h-11 w-11" fill="none" aria-hidden>
      {/* bandana tails streaming back */}
      <path
        d="M13 10 L2 6 M13 13 L1 12"
        stroke="#E03131"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* limb pose A */}
      <g className="ninja-stride-a">
        <path d="M20 22 L13 27" stroke="#0f0f0f" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 22 L28 25" stroke="#1c1c1c" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 34 L13 47" stroke="#0f0f0f" strokeWidth="5" strokeLinecap="round" />
        <path d="M20 34 L29 45" stroke="#1c1c1c" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* limb pose B (swapped) */}
      <g className="ninja-stride-b">
        <path d="M20 22 L28 26" stroke="#0f0f0f" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 22 L13 24" stroke="#1c1c1c" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 34 L29 47" stroke="#0f0f0f" strokeWidth="5" strokeLinecap="round" />
        <path d="M20 34 L13 45" stroke="#1c1c1c" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* body */}
      <rect x="15" y="16" width="11" height="20" rx="5" fill="#141414" />
      {/* head */}
      <circle cx="20.5" cy="11" r="7.5" fill="#f3dcc4" />
      {/* bandana over the upper head */}
      <path d="M13 9 Q20.5 2 28 9 L28 11.5 Q20.5 6 13 11.5 Z" fill="#E03131" />
      {/* eye band */}
      <rect x="14" y="10.5" width="13" height="3.2" rx="1.6" fill="#141414" />
      {/* eye glint */}
      <circle cx="23" cy="12.1" r="0.9" fill="#fff" />
    </svg>
  );
}
