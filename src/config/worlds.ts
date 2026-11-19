export type WorldId = 'candy' | 'pirate' | 'space';

export interface WorldConfig {
  id: WorldId;
  name: string;
  subtitle: string;
  trackLength: number;
  skyColor: string;
  trackColor: string;
  borderColor: string;
  stripeColor: string;
  obstacleColor: string;
  obstacleSpeedMultiplier: number;
  badgeColor: string;
}

export const WORLDS: Record<WorldId, WorldConfig> = {
  candy: {
    id: 'candy',
    name: 'مدينة الحلوى',
    subtitle: 'ألوان زاهية وحواجز سريعة مرحة',
    trackLength: 140,
    skyColor: '#bae6fd',
    trackColor: '#38bdf8',
    borderColor: '#f43f5e',
    stripeColor: '#e0f2fe',
    obstacleColor: '#fb923c',
    obstacleSpeedMultiplier: 1.0,
    badgeColor: '#0284c7',
  },
  pirate: {
    id: 'pirate',
    name: 'شاطئ القراصنة',
    subtitle: 'رمال ذهبية وأمواج زرقاء وحركة أسرع',
    trackLength: 165,
    skyColor: '#fef08a',
    trackColor: '#f59e0b',
    borderColor: '#0284c7',
    stripeColor: '#fef9c3',
    obstacleColor: '#ef4444',
    obstacleSpeedMultiplier: 1.2,
    badgeColor: '#d97706',
  },
  space: {
    id: 'space',
    name: 'محطة الفضاء',
    subtitle: 'سماء ليلية عميقة ومضمار طويل مليء بالتحدي',
    trackLength: 190,
    skyColor: '#1e1b4b',
    trackColor: '#4f46e5',
    borderColor: '#22d3ee',
    stripeColor: '#a5b4fc',
    obstacleColor: '#f43f5e',
    obstacleSpeedMultiplier: 1.35,
    badgeColor: '#4338ca',
  },
};

export const WORLD_LIST: WorldConfig[] = [WORLDS.candy, WORLDS.pirate, WORLDS.space];