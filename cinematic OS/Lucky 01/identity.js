export function identifyCharacter(id) {
  // naive lookup for demo
  const map = { ayaan: 'Ayaan', max: 'Max' };
  return map[id] || 'Unknown';
}
