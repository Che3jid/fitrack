type IllustratedSection = 'diet' | 'training' | 'trends';

// Decorative illustrations only; the trend motif does not represent user data.
const drawings: Record<IllustratedSection, string> = {
  diet: `<circle cx="81" cy="57" r="38" fill="currentColor" opacity=".08"/>
    <circle cx="81" cy="57" r="31" fill="#fff" stroke="#303034" stroke-width="2"/>
    <circle cx="81" cy="57" r="24" fill="none" stroke="currentColor" opacity=".3" stroke-width="1.5"/>
    <path d="M64 62c-5-14 6-26 17-16 11-10 22 2 17 16-3 8-12 12-17 12S67 70 64 62z" fill="currentColor"/>
    <path d="M81 47c-1-8 4-13 12-13-1 8-5 12-12 13" fill="#303034"/>
    <path d="M29 28v19m-7-19v12c0 10 14 10 14 0V28m-7 21v37m98 0V29c-9 5-12 14-12 26h12" fill="none" stroke="#303034" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="112" cy="21" r="3" fill="currentColor"/>
    <path d="M45 91h72" stroke="currentColor" opacity=".2" stroke-width="2" stroke-linecap="round"/>`,
  training: `<ellipse cx="79" cy="94" rx="47" ry="6" fill="currentColor" opacity=".1"/>
    <path d="M58 44V33c0-27 42-27 42 0v11" fill="none" stroke="#303034" stroke-width="10" stroke-linecap="round"/>
    <path d="M59 39h40c5 8 11 20 11 32 0 15-11 22-31 22S48 86 48 71c0-12 6-24 11-32z" fill="#303034"/>
    <path d="M69 46c-9 8-14 23-10 31" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
    <circle cx="80" cy="67" r="13" fill="currentColor"/>
    <path d="M74 67h12m-6-6v12" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <path d="M124 61V45m8 16V35m8 26V25" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".4"/>
    <path d="M24 37h10m-5-5v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  trends: `<rect x="24" y="19" width="112" height="77" rx="12" fill="currentColor" opacity=".06"/>
    <g stroke="#303034" opacity=".12" stroke-width="1"><path d="M38 38h84M38 56h84M38 74h84M54 31v52m23-52v52m23-52v52"/></g>
    <path d="M37 80l20-23 23 8 23-27 20 9" fill="none" stroke="#303034" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M37 85c18-3 24-10 43-13s24-11 43-14" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>
    <g fill="currentColor" stroke="#fff" stroke-width="2"><circle cx="57" cy="57" r="4"/><circle cx="80" cy="65" r="4"/><circle cx="103" cy="38" r="4"/></g>
    <circle cx="133" cy="22" r="11" fill="currentColor"/>
    <path d="M128 23l3 3 7-8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export function sectionArt(section: IllustratedSection): string {
  return `<svg class="section-art section-art-${section}" viewBox="0 0 160 110" fill="none" aria-hidden="true" focusable="false">${drawings[section]}</svg>`;
}
