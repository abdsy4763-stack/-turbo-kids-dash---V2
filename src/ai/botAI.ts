import type { RacerState } from '../components/GameScene';
import type { ObstacleData, StarData, PowerUpBoxData } from '../components/Track';

// ============================================================
//  إعدادات الصعوبة وشخصيات الروبوتات + عقل الروبوت (الذكاء الاصطناعي)
//  عدّل الأرقام في الجداول أدناه لتغيير إحساس اللعب بسهولة
// ============================================================

export type DifficultyId = 'easy' | 'normal' | 'hard';
export type BotPersonality = 'reckless' | 'careful' | 'collector';
export type BotPlan = 'none' | 'dodge' | 'jump';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  subtitle: string;
  baseSpeed: number; // سرعة الروبوت كنسبة من سرعة اللاعب (1 = مثل اللاعب)
  reaction: number; // كل كم ثانية يتخذ الروبوت قرارًا جديدًا (الأقل = أذكى)
  lookAhead: number; // المسافة التي يرى بها العقبات أمامه
  mistakeChance: number; // احتمال تجاهل عقبة بالخطأ
  jumpError: number; // خطأ توقيت القفز (الأقل = أدق)
  predictive: boolean; // هل يتوقع مكان العقبة المتحركة قبل وصولها؟
  dashRate: number; // مرات استخدام الاندفاع في الثانية (تقريبًا)
  powerRate: number; // سرعة استخدام القدرات المخزّنة
  catchUp: number; // أقصى تسريع إذا تأخر عن اللاعب (تعويض)
  slowDown: number; // أقصى تبطيء إذا تقدم كثيرًا على اللاعب
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'سهل',
    subtitle: 'روبوتات مبتدئة ترتكب أخطاء كثيرة، مناسب للصغار',
    baseSpeed: 0.78,
    reaction: 0.35,
    lookAhead: 6,
    mistakeChance: 0.25,
    jumpError: 0.18,
    predictive: false,
    dashRate: 0.1,
    powerRate: 0.3,
    catchUp: 0.04,
    slowDown: 0.12,
  },
  normal: {
    id: 'normal',
    name: 'عادي',
    subtitle: 'سباق متقارب يحتاج منك قفزًا واندفاعًا في الوقت المناسب',
    baseSpeed: 0.9,
    reaction: 0.2,
    lookAhead: 8,
    mistakeChance: 0.08,
    jumpError: 0.08,
    predictive: false,
    dashRate: 0.35,
    powerRate: 0.6,
    catchUp: 0.08,
    slowDown: 0.06,
  },
  hard: {
    id: 'hard',
    name: 'صعب',
    subtitle: 'روبوتات تتوقع حركة العقبات وتستخدم الاندفاع والقدرات بذكاء',
    baseSpeed: 0.94,
    reaction: 0.1,
    lookAhead: 10,
    mistakeChance: 0.01,
    jumpError: 0.02,
    predictive: true,
    dashRate: 0.8,
    powerRate: 1.2,
    catchUp: 0.1,
    slowDown: 0.03,
  },
};

export const DIFFICULTY_LIST: DifficultyConfig[] = [
  DIFFICULTIES.easy,
  DIFFICULTIES.normal,
  DIFFICULTIES.hard,
];

interface PersonalityConfig {
  name: string;
  speedMul: number; // مضاعف السرعة
  dashMul: number; // ميله لاستخدام الاندفاع
  jumpPref: number; // احتمال أن يقفز فوق العقبة بدل الالتفاف حولها (0 إلى 1)
  lookBonus: number; // يرى أبعد (+) أو أقرب (-)
  starInterest: number; // اهتمامه بجمع النجوم (0 إلى 1)
  boxInterest: number; // اهتمامه بصناديق المفاجآت (0 إلى 1)
}

export const PERSONALITIES: Record<BotPersonality, PersonalityConfig> = {
  reckless: {
    name: 'متهور',
    speedMul: 1.03,
    dashMul: 1.6,
    jumpPref: 0.7,
    lookBonus: -2,
    starInterest: 0.1,
    boxInterest: 0.5,
  },
  careful: {
    name: 'حذر',
    speedMul: 0.98,
    dashMul: 0.6,
    jumpPref: 0.1,
    lookBonus: 2.5,
    starInterest: 0.35,
    boxInterest: 0.4,
  },
  collector: {
    name: 'جامع النجوم',
    speedMul: 0.97,
    dashMul: 0.8,
    jumpPref: 0.3,
    lookBonus: 0,
    starInterest: 1,
    boxInterest: 0.8,
  },
};

export interface BotContext {
  dt: number;
  difficulty: DifficultyConfig;
  raceTime: number;
  obstacleSpeedMultiplier: number;
  obstacles: ObstacleData[];
  stars: StarData[];
  powerUps: PowerUpBoxData[];
  racers: RacerState[];
}

export interface BotInput {
  moveX: number;
  moveZ: number;
  jump: boolean;
  dash: boolean;
  power: boolean;
}

const NORMAL_SPEED = 10.5;
const DASH_SPEED = 18.5;
const LANE_LIMIT = 4.8;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
// احتمال حدوث شيء "بمعدل X مرة في الثانية" خلال هذا الإطار
const chance = (ratePerSecond: number, dt: number) => Math.random() < ratePerSecond * dt;

// أقرب عقبة أمام الروبوت ضمن مسافة معيّنة
function nearestObstacleAhead(
  racer: RacerState,
  obstacles: ObstacleData[],
  maxDist: number
): { obs: ObstacleData; dist: number } | null {
  let best: { obs: ObstacleData; dist: number } | null = null;
  for (const obs of obstacles) {
    const dist = racer.pos[2] - obs.z; // موجب = العقبة أمامي
    if (dist > 0.3 && dist < maxDist && (!best || dist < best.dist)) {
      best = { obs, dist };
    }
  }
  return best;
}

// يتخذ الروبوت قرارًا جديدًا: هل يلتف حول العقبة أم يقفز أم يلاحق نجمة/صندوقًا؟
function decide(racer: RacerState, ctx: BotContext) {
  const cfg = ctx.difficulty;
  const prof = PERSONALITIES[racer.personality];
  const speed = racer.isDashing ? DASH_SPEED : NORMAL_SPEED;
  const look = Math.max(4, cfg.lookAhead + prof.lookBonus);

  racer.aiPlan = 'none';
  racer.aiTargetX = null;
  racer.aiJumpLead = 0.34 + (Math.random() - 0.5) * cfg.jumpError;

  const threat = nearestObstacleAhead(racer, ctx.obstacles, look);
  if (threat) {
    // مكان العقبة عند وصولي إليها (الروبوت الصعب يتوقعه، والسهل يرى مكانها الحالي فقط)
    let obsX = threat.obs.currentX;
    if (cfg.predictive) {
      const arriveIn = threat.dist / speed;
      obsX =
        Math.sin(
          (ctx.raceTime + arriveIn) * threat.obs.speed * ctx.obstacleSpeedMultiplier +
            threat.obs.id
        ) * threat.obs.range;
    }

    if (Math.abs(obsX - racer.pos[0]) < 2.0) {
      if (Math.random() < cfg.mistakeChance) return; // خطأ: تجاهل العقبة

      if (Math.random() < prof.jumpPref) {
        racer.aiPlan = 'jump';
        return;
      }
      // الالتفاف: يتحرك بعيدًا عن العقبة، وإن لم يجد مكانًا يقفز
      let dir = racer.pos[0] >= obsX ? 1 : -1;
      if (Math.abs(racer.pos[0] + dir * 2.5) > LANE_LIMIT) dir = -dir;
      const target = clamp(obsX + dir * 2.6, -LANE_LIMIT, LANE_LIMIT);
      if (Math.abs(target - obsX) < 2.0) {
        racer.aiPlan = 'jump';
      } else {
        racer.aiPlan = 'dodge';
        racer.aiTargetX = target;
      }
      return;
    }
  }

  // لا خطر قريب: يلاحق صندوق مفاجأة أو نجمة حسب شخصيته
  if (!racer.heldPowerUp && Math.random() < prof.boxInterest) {
    let bestBox: PowerUpBoxData | null = null;
    for (const box of ctx.powerUps) {
      const d = racer.pos[2] - box.z;
      if (!box.collectedBy.includes(racer.id) && d > 0 && d < 12 && (!bestBox || d < racer.pos[2] - bestBox.z)) {
        bestBox = box;
      }
    }
    if (bestBox) {
      racer.aiTargetX = clamp(bestBox.x, -LANE_LIMIT, LANE_LIMIT);
      return;
    }
  }
  if (Math.random() < prof.starInterest) {
    let bestStar: StarData | null = null;
    for (const star of ctx.stars) {
      const d = racer.pos[2] - star.z;
      if (!star.collectedBy.includes(racer.id) && d > 0 && d < 16 && (!bestStar || d < racer.pos[2] - bestStar.z)) {
        bestStar = star;
      }
    }
    if (bestStar) racer.aiTargetX = clamp(bestStar.x, -LANE_LIMIT, LANE_LIMIT);
  }
}

// الدالة الرئيسية: تُرجع "ضغطات الأزرار" التي يفعلها الروبوت في هذا الإطار
export function computeBotInput(racer: RacerState, ctx: BotContext): BotInput {
  const { dt, difficulty: cfg } = ctx;
  const prof = PERSONALITIES[racer.personality];

  // 1) اتخاذ القرار كل فترة قصيرة وليس كل إطار
  racer.aiTimer -= dt;
  if (racer.aiTimer <= 0) {
    racer.aiTimer = cfg.reaction * (0.8 + Math.random() * 0.4);
    decide(racer, ctx);
  }

  // 2) تعويض السرعة: يتسارع قليلًا إن تأخر عن أول لاعب، ويتباطأ إن تقدّم كثيرًا
  let rubber = 1;
  const humans = ctx.racers.filter((r) => !r.isBot);
  if (humans.length > 0) {
    const leaderZ = Math.min(...humans.map((h) => h.pos[2]));
    const factor = clamp((racer.pos[2] - leaderZ) / 25, -1, 1); // موجب = الروبوت متأخر
    rubber = 1 + (factor > 0 ? factor * cfg.catchUp : factor * cfg.slowDown);
  }
  const worldMul = Math.min(ctx.obstacleSpeedMultiplier, 1.15);
  const moveZ = -clamp(cfg.baseSpeed * prof.speedMul * rubber * worldMul, 0.4, 1.15);

  // 3) الحركة الجانبية نحو الهدف
  let moveX = 0;
  if (racer.aiTargetX !== null) {
    const diff = racer.aiTargetX - racer.pos[0];
    if (Math.abs(diff) > 0.2) moveX = clamp(diff * 2.5, -1, 1);
  }

  // 4) القفز: عندما تقترب العقبة المقصودة إلى مسافة القفز المناسبة لسرعته الحالية
  let jump = false;
  const speed = racer.isDashing ? DASH_SPEED : NORMAL_SPEED;
  if (racer.aiPlan === 'jump' && racer.isGrounded) {
    const near = nearestObstacleAhead(racer, ctx.obstacles, speed * 0.7);
    if (
      near &&
      near.dist <= racer.aiJumpLead * speed &&
      Math.abs(near.obs.currentX - racer.pos[0]) < 1.7
    ) {
      jump = true;
      racer.aiPlan = 'none';
    }
  }

  // 5) الاندفاع: فقط حين يكون الطريق أمامه خاليًا
  let dash = false;
  if (racer.dashCooldown <= 0 && !racer.isDashing) {
    const blocked = nearestObstacleAhead(racer, ctx.obstacles, 9);
    const pathClear = !blocked || Math.abs(blocked.obs.currentX - racer.pos[0]) > 2.4;
    dash = pathClear && chance(cfg.dashRate * prof.dashMul, dt);
  }

  // 6) استخدام القدرة المخزّنة
  let power = false;
  if (racer.heldPowerUp) {
    const close = nearestObstacleAhead(racer, ctx.obstacles, 6);
    if (racer.heldPowerUp === 'turbo') {
      power = !close && chance(cfg.powerRate, dt);
    } else if (racer.heldPowerUp === 'shield') {
      power = close ? chance(cfg.powerRate * 4, dt) : chance(cfg.powerRate * 0.2, dt);
    } else {
      power = chance(cfg.powerRate * 0.5, dt);
    }
  }

  return { moveX, moveZ, jump, dash, power };
}