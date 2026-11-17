export function calculateMatchScore(
  requiredSkills: string[],
  freelancerSkills: string[],
) {
  const normalize = (skill: string) => skill.trim().toLowerCase();
  const required = new Map<string, string>();
  for (const skill of requiredSkills) {
    const key = normalize(skill);
    if (key && !required.has(key)) required.set(key, skill.trim());
  }
  const available = new Set(freelancerSkills.map(normalize));
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const [key, label] of required) {
    (available.has(key) ? matchedSkills : missingSkills).push(label);
  }
  return {
    score: required.size
      ? Math.round((100 * matchedSkills.length) / required.size)
      : 0,
    matchedSkills,
    missingSkills,
  };
}
