const visuals: Record<string, string> = {
  tongue_retract: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g fill="#f5c2b0"><ellipse cx="100" cy="60" rx="60" ry="20"/></g><path d="M40 60 C70 40 130 40 160 60" stroke="#a33" stroke-width="3" fill="none"/></svg>`,
  cluster_maintain: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g stroke="#333" stroke-width="3" fill="none"><path d="M20 60 L60 40 L100 60"/><circle cx="20" cy="60" r="4"/><circle cx="60" cy="40" r="4"/><circle cx="100" cy="60" r="4"/></g></svg>`,
  aspiration_burst: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g><rect x="10" y="35" width="60" height="30" fill="#eee" stroke="#333"/><path d="M80 50 q20 -12 40 0" stroke="#333" fill="none" stroke-width="2"/><text x="12" y="28" font-size="12">Feel the burst</text></g></svg>`,
  final_release: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g fill="#fff" stroke="#333"><rect x="20" y="30" width="50" height="20"/><path d="M80 40 l20 0"/></g><text x="20" y="75" font-size="12">Hold & release</text></svg>`,
  stress_wave: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60"><polyline points="0,30 30,30 45,18 75,42 105,30 135,50 165,30 200,30" fill="none" stroke="#333" stroke-width="2"/></svg>`,
  syllable_clips: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><text x="10" y="30" font-size="18">sy-lla-ble</text></svg>`,
  vowel_front_back: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><g><rect x="10" y="10" width="180" height="60" fill="#fafafa" stroke="#ccc"/><text x="20" y="40" font-size="12">Front & Back Tongue</text></g></svg>`,
  tongue_tip_dental: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g><path d="M60 60 q20 -30 80 0" stroke="#333" fill="#f5c2b0" stroke-width="2"/><text x="20" y="90" font-size="12">Place tip between teeth</text></g></svg>`,
};

// Backward-compatibility aliases: keep legacy keys without duplicate SVG payloads.
visuals.cluster_maintain2 = visuals.cluster_maintain;
visuals.aspiration_burst2 = visuals.aspiration_burst;
visuals.final_release2 = visuals.final_release;

// add some richer animated-friendly SVG templates keyed for frontend
export const visualsMeta: Record<string, { svg: string; primaryId?: string }> = {
  aspiration_puff: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><g id="puff" fill="#cce7ff"><ellipse cx="170" cy="60" rx="40" ry="18" opacity="0.95"/></g><g stroke="#333" fill="none"><rect x="20" y="45" width="80" height="30" rx="6"/></g><text x="20" y="30" font-size="12">Aspiration: puff after release</text></svg>`,
    primaryId: 'puff'
  },
  tongue_retract_motion: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 140"><g id="tongue" fill="#f5c2b0"><ellipse cx="130" cy="90" rx="70" ry="22"/></g><path d="M40 90 C90 60 170 60 220 90" stroke="#a33" stroke-width="3" fill="none"/><text x="12" y="24" font-size="12">Tongue retraction (back vowels)</text></svg>`,
    primaryId: 'tongue'
  },
  stress_pulse: {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><g id="pulse" stroke="#333" stroke-width="2" fill="none"><polyline points="0,40 40,40 60,20 100,60 140,40 180,70 220,40 300,40"/></g></svg>`,
    primaryId: 'pulse'
  }
};

export default visuals;
