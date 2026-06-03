export function evaluateBadgesFromProfile(profile: any) {
  const badges: any[] = [];
  if (!profile) return badges;

  // Badge: filler-free streak
  if ((profile.fillerCount || 0) < 3) {
    badges.push({ id: 'filler_minimal', name: 'Filler Minimalist', description: 'Used very few filler words recently', awarded: true });
  }

  // Badge: TH Master (placeholder: if recurringPhenomena['th_issue'] > threshold )
  if (profile.recurringPhenomena && profile.recurringPhenomena['th_issue'] > 5) {
    badges.push({ id: 'th_master', name: 'TH Tamer', description: 'Repeated TH practice and improvement', awarded: true });
  }

  // Badge: consistent pace
  const lastPacing = (profile.pacingHistory || []).slice(-5).map((p:any)=>p.wps || 0);
  const stable = lastPacing.length && (Math.max(...lastPacing) - Math.min(...lastPacing) < 1.0);
  if (stable) badges.push({ id: 'steady_pacer', name: 'Steady Pacer', description: 'Consistent pacing across recent attempts', awarded: true });

  return badges;
}

export default { evaluateBadgesFromProfile };
