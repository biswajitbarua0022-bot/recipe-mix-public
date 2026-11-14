import type { Motif } from './recipe'

const motifs = {
  dal: (
    <>
      <path d="M13 54c-5 0-8 4-8 9m102-9c5 0 8 4 8 9" />
      <path d="M13 61c0 23 19 36 47 36s47-13 47-36" fill="var(--turmeric-300)" />
      <ellipse cx="60" cy="61" rx="47" ry="8.5" fill="var(--turmeric-500)" />
      <path d="M45 40c-6-6 5-8 0-14m17 14c-6-6 5-8 0-14m17 14c-6-6 5-8 0-14" stroke="var(--sage-500)" />
      <circle cx="46" cy="59" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="57" cy="63" r="2.2" fill="currentColor" stroke="none" />
      <path d="M69 59c4-4 6-3 10 0" stroke="var(--tomato-500)" />
    </>
  ),
  peas: (
    <>
      <path d="M17 108 106 12M36 108l69-72" />
      <g fill="var(--sage-500)" strokeWidth="2.6">
        <ellipse cx="22" cy="78" rx="15" ry="6" transform="rotate(-49 22 78)" />
        <ellipse cx="38" cy="60" rx="15" ry="6" transform="rotate(-49 38 60)" />
        <ellipse cx="54" cy="42" rx="15" ry="6" transform="rotate(-49 54 42)" />
        <ellipse cx="70" cy="24" rx="15" ry="6" transform="rotate(-49 70 24)" />
        <ellipse cx="46" cy="99" rx="14" ry="6" transform="rotate(-46 46 99)" />
        <ellipse cx="62" cy="82" rx="14" ry="6" transform="rotate(-46 62 82)" />
        <ellipse cx="78" cy="65" rx="14" ry="6" transform="rotate(-46 78 65)" />
        <ellipse cx="94" cy="48" rx="14" ry="6" transform="rotate(-46 94 48)" />
        <ellipse cx="102" cy="16" rx="13" ry="6" transform="rotate(-46 102 16)" />
      </g>
    </>
  ),
  potato: (
    <>
      <path d="M16 63c3-23 24-33 52-33 28 0 42 16 37 37-5 20-22 31-51 32-25 1-42-12-38-36Z" fill="#d9b37d" />
      <path d="M77 25c10-7 19-6 28-1-10 5-19 7-28 1Z" fill="var(--sage-500)" strokeWidth="2.6" />
      <path d="M40 57q4-3 8 1m26-7q4-3 7 3M60 77q4-3 8 2m17-7q3-3 7-2" strokeWidth="2.5" />
    </>
  ),
  lemon: (
    <>
      <path d="m9 61-5-3m101 1 6-3M12 59c6-18 23-30 45-30 23 0 44 13 48 30-6 18-24 28-46 29-22 0-42-10-47-29Z" fill="var(--turmeric-300)" />
      <path d="M57 30c0-12 7-18 20-19-1 12-7 19-20 19Z" fill="var(--sage-500)" />
      <circle cx="86" cy="89" r="21" fill="var(--turmeric-100)" />
      <path d="M86 73v32m-16-16h32M75 78l22 22m0-22-22 22" stroke="var(--line-strong)" strokeWidth="2" />
    </>
  ),
  spinach: (
    <>
      <path d="M29 11C60 14 78 33 75 60c-1 8-7 17-15 22C29 74 19 47 29 11Z" fill="var(--sage-500)" />
      <path d="M30 14c6 22 19 39 30 68m-24-43 9 6m10-11 7-12m-4 34 8-12M37 57l14 4" stroke="var(--sage-100)" strokeWidth="2.4" />
      <path d="M60 83v29" />
      <rect x="74" y="75" width="27" height="26" rx="4" fill="white" strokeWidth="2.7" />
      <rect x="85" y="64" width="25" height="23" rx="4" fill="white" strokeWidth="2.7" />
    </>
  ),
  eggs: (
    <>
      <path d="M22 54c0-19 11-39 24-39 14 0 25 20 25 39a25 25 0 0 1-49 0Z" fill="white" />
      <path d="M31 39c2-9 7-15 12-17" stroke="var(--cream-300)" strokeWidth="2.7" />
      <ellipse cx="83" cy="90" rx="23" ry="22" transform="rotate(-19 83 90)" fill="white" />
      <circle cx="82" cy="89" r="10" fill="var(--turmeric-500)" strokeWidth="2.7" />
    </>
  ),
} satisfies Record<Motif, React.ReactNode>

export function RecipeArt({ motif }: { motif: Motif }) {
  return (
    <svg className="recipe-art" viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round">
      {motifs[motif]}
    </svg>
  )
}
