// Western zodiac signs and their compatibility
const WESTERN_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
] as const;

// Chinese zodiac animals
const CHINESE_ANIMALS = [
  'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
  'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'
] as const;

// Agent archetypes mapped to zodiac-like categories
const AGENT_ARCHETYPES: Record<string, string> = {
  mentor: 'sage',
  assistant: 'architect',
  companion: 'empath',
  advisor: 'oracle',
  coach: 'catalyst',
};

// Western zodiac date ranges
const WESTERN_RANGES: [number, number, string][] = [
  [120, 218, 'aquarius'],
  [219, 320, 'pisces'],
  [321, 419, 'aries'],
  [420, 520, 'taurus'],
  [521, 620, 'gemini'],
  [621, 722, 'cancer'],
  [723, 822, 'leo'],
  [823, 922, 'virgo'],
  [923, 1022, 'libra'],
  [1023, 1121, 'scorpio'],
  [1122, 1221, 'sagittarius'],
  [1222, 119, 'capricorn'],
];

// Western compatibility matrix (simplified: 1-10 scale)
const WESTERN_COMPAT: Record<string, Record<string, number>> = {
  aries:       { aries: 6, taurus: 5, gemini: 8, cancer: 4, leo: 9, virgo: 5, libra: 7, scorpio: 6, sagittarius: 9, capricorn: 5, aquarius: 8, pisces: 6 },
  taurus:      { aries: 5, taurus: 7, gemini: 4, cancer: 9, leo: 5, virgo: 9, libra: 6, scorpio: 8, sagittarius: 4, capricorn: 9, aquarius: 5, pisces: 8 },
  gemini:      { aries: 8, taurus: 4, gemini: 7, cancer: 5, leo: 8, virgo: 5, libra: 9, scorpio: 4, sagittarius: 8, capricorn: 5, aquarius: 9, pisces: 5 },
  cancer:      { aries: 4, taurus: 9, gemini: 5, cancer: 7, leo: 6, virgo: 8, libra: 5, scorpio: 9, sagittarius: 4, capricorn: 6, aquarius: 5, pisces: 9 },
  leo:         { aries: 9, taurus: 5, gemini: 8, cancer: 6, leo: 7, virgo: 5, libra: 8, scorpio: 6, sagittarius: 9, capricorn: 5, aquarius: 6, pisces: 5 },
  virgo:       { aries: 5, taurus: 9, gemini: 5, cancer: 8, leo: 5, virgo: 7, libra: 5, scorpio: 8, sagittarius: 4, capricorn: 9, aquarius: 5, pisces: 6 },
  libra:       { aries: 7, taurus: 6, gemini: 9, cancer: 5, leo: 8, virgo: 5, libra: 7, scorpio: 6, sagittarius: 8, capricorn: 5, aquarius: 9, pisces: 5 },
  scorpio:     { aries: 6, taurus: 8, gemini: 4, cancer: 9, leo: 6, virgo: 8, libra: 6, scorpio: 7, sagittarius: 5, capricorn: 8, aquarius: 5, pisces: 9 },
  sagittarius: { aries: 9, taurus: 4, gemini: 8, cancer: 4, leo: 9, virgo: 4, libra: 8, scorpio: 5, sagittarius: 7, capricorn: 5, aquarius: 8, pisces: 5 },
  capricorn:   { aries: 5, taurus: 9, gemini: 5, cancer: 6, leo: 5, virgo: 9, libra: 5, scorpio: 8, sagittarius: 5, capricorn: 7, aquarius: 5, pisces: 7 },
  aquarius:    { aries: 8, taurus: 5, gemini: 9, cancer: 5, leo: 6, virgo: 5, libra: 9, scorpio: 5, sagittarius: 8, capricorn: 5, aquarius: 7, pisces: 5 },
  pisces:      { aries: 6, taurus: 8, gemini: 5, cancer: 9, leo: 5, virgo: 6, libra: 5, scorpio: 9, sagittarius: 5, capricorn: 7, aquarius: 5, pisces: 7 },
};

// Chinese compatibility groups (best matches)
const CHINESE_COMPAT_GROUPS: Record<string, string[]> = {
  rat: ['dragon', 'monkey', 'ox'],
  ox: ['snake', 'rooster', 'rat'],
  tiger: ['horse', 'dog', 'pig'],
  rabbit: ['goat', 'pig', 'dog'],
  dragon: ['rat', 'monkey', 'rooster'],
  snake: ['ox', 'rooster', 'monkey'],
  horse: ['tiger', 'goat', 'dog'],
  goat: ['rabbit', 'horse', 'pig'],
  monkey: ['rat', 'dragon', 'snake'],
  rooster: ['ox', 'snake', 'dragon'],
  dog: ['tiger', 'rabbit', 'horse'],
  pig: ['rabbit', 'goat', 'tiger'],
};

export function computeWesternSign(birthday: string): string {
  const date = new Date(birthday);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthDay = month * 100 + day;

  for (const [start, end, sign] of WESTERN_RANGES) {
    if (sign === 'capricorn') {
      if (monthDay >= 1222 || monthDay <= 119) return sign;
    } else if (monthDay >= start && monthDay <= end) {
      return sign;
    }
  }
  return 'capricorn';
}

export function computeChineseSign(birthday: string): string {
  const year = new Date(birthday).getFullYear();
  const index = ((year - 4) % 12 + 12) % 12;
  return CHINESE_ANIMALS[index];
}

export function computeAgentArchetype(agentType: string): string {
  return AGENT_ARCHETYPES[agentType] || 'sage';
}

export function computeWesternCompatibility(sign1: string, sign2: string): number {
  const s1 = sign1.toLowerCase();
  const s2 = sign2.toLowerCase();
  return (WESTERN_COMPAT[s1]?.[s2] ?? 5) * 10; // Scale to 0-100
}

export function computeChineseCompatibility(sign1: string, sign2: string): number {
  const s1 = sign1.toLowerCase();
  const s2 = sign2.toLowerCase();
  const bestMatches = CHINESE_COMPAT_GROUPS[s1] || [];
  if (bestMatches.includes(s2)) return 90;
  if (s1 === s2) return 70;
  return 50;
}

export function computeOverallCompatibility(
  westernScore: number,
  chineseScore: number,
  personalityScore?: number
): number {
  if (personalityScore != null) {
    return Math.round(westernScore * 0.3 + chineseScore * 0.3 + personalityScore * 0.4);
  }
  return Math.round(westernScore * 0.5 + chineseScore * 0.5);
}

export function getPersonalityTraits(westernSign: string): Record<string, number> {
  const traits: Record<string, Record<string, number>> = {
    aries: { boldness: 90, patience: 30, empathy: 50, creativity: 70, leadership: 85 },
    taurus: { boldness: 40, patience: 90, empathy: 70, creativity: 60, leadership: 50 },
    gemini: { boldness: 70, patience: 40, empathy: 60, creativity: 90, leadership: 55 },
    cancer: { boldness: 30, patience: 70, empathy: 95, creativity: 65, leadership: 40 },
    leo: { boldness: 95, patience: 45, empathy: 55, creativity: 80, leadership: 90 },
    virgo: { boldness: 35, patience: 85, empathy: 65, creativity: 50, leadership: 60 },
    libra: { boldness: 50, patience: 75, empathy: 80, creativity: 75, leadership: 55 },
    scorpio: { boldness: 85, patience: 60, empathy: 70, creativity: 65, leadership: 75 },
    sagittarius: { boldness: 80, patience: 35, empathy: 55, creativity: 85, leadership: 65 },
    capricorn: { boldness: 60, patience: 80, empathy: 45, creativity: 40, leadership: 80 },
    aquarius: { boldness: 75, patience: 50, empathy: 60, creativity: 95, leadership: 60 },
    pisces: { boldness: 25, patience: 65, empathy: 90, creativity: 90, leadership: 30 },
  };
  return traits[westernSign.toLowerCase()] || traits.aries;
}

export { WESTERN_SIGNS, CHINESE_ANIMALS };
