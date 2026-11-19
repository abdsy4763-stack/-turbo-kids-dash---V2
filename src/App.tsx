import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Gamepad2, Trophy, Users, User, RotateCcw, Star, Zap, MapPin, Timer } from 'lucide-react';
import { GameScene, type RacerState } from './components/GameScene';
import {
  type ObstacleData,
  type StarData,
  type PowerUpBoxData,
  type PowerUpType,
  type RaceState,
} from './components/Track';
import { WORLDS, WORLD_LIST, type WorldId } from './config/worlds';
import {
  DIFFICULTIES,
  DIFFICULTY_LIST,
  type BotPersonality,
  type DifficultyId,
} from './ai/botAI';

const POWERUP_LABELS: Record<PowerUpType, string> = {
  turbo: 'صاروخ توربو',
  shield: 'درع واقٍ',
  superJump: 'قفزة فائقة',
};

function makeRacer(
  id: number,
  name: string,
  color: string,
  isBot: boolean,
  x: number,
  personality: BotPersonality
): RacerState {
  return {
    id,
    name,
    color,
    isBot,
    pos: [x, 0, 0],
    velY: 0,
    rotY: Math.PI,
    isGrounded: true,
    isDashing: false,
    dashCooldown: 0,
    dashTimer: 0,
    hitTimer: 0,
    heldPowerUp: null,
    shieldTimer: 0,
    superJumpTimer: 0,
    stars: 0,
    finished: false,
    finishTime: 0,
    personality,
    aiTimer: 0,
    aiTargetX: null,
    aiPlan: 'none',
    aiJumpLead: 0.34,
  };
}

function createInitialRacers(mode: 'single' | 'multi'): RacerState[] {
  return [
    makeRacer(0, 'اللاعب 1 (أزرق)', '#2563eb', false, -3, 'careful'),
    mode === 'multi'
      ? makeRacer(1, 'اللاعب 2 (وردي)', '#ec4899', false, -1, 'careful')
      : makeRacer(1, 'روبوت متهور (وردي)', '#ec4899', true, -1, 'reckless'),
    makeRacer(2, 'روبوت حذر (أخضر)', '#10b981', true, 1, 'careful'),
    makeRacer(3, 'روبوت جامع النجوم (بنفسجي)', '#8b5cf6', true, 3, 'collector'),
  ];
}

function createObstacles(trackLength: number): ObstacleData[] {
  const count = Math.floor((trackLength - 20) / 11);
  const list: ObstacleData[] = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      id: i,
      z: -i * 11,
      speed: 1.5 + (i % 3) * 0.6,
      range: 3.8,
      currentX: 0,
    });
  }
  return list;
}

function createStars(trackLength: number): StarData[] {
  const count = Math.floor((trackLength - 14) / 7);
  const list: StarData[] = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      id: i,
      x: ((i * 7) % 9) - 4,
      z: -i * 7,
      collectedBy: [],
    });
  }
  return list;
}

function createPowerUps(trackLength: number): PowerUpBoxData[] {
  const count = Math.floor((trackLength - 18) / 18);
  const list: PowerUpBoxData[] = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      id: i,
      x: i % 2 === 0 ? -2.2 : 2.2,
      z: -i * 18,
      collectedBy: [],
    });
  }
  return list;
}

// ترتيب السباقين: من وصل أولًا (الأقل زمنًا)، ثم الباقون حسب المسافة المقطوعة
function compareRacers(a: RacerState, b: RacerState): number {
  if (a.finished && b.finished) return a.finishTime - b.finishTime;
  if (a.finished) return -1;
  if (b.finished) return 1;
  return a.pos[2] - b.pos[2];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

function createRace(): RaceState {
  return { countdown: 3, started: false, elapsed: 0, goTimer: 0 };
}

export function App() {
  const [screen, setScreen] = useState<'menu' | 'playing' | 'results'>('menu');
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [selectedWorld, setSelectedWorld] = useState<WorldId>('candy');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [gamepadCount, setGamepadCount] = useState(0);
  const [hudData, setHudData] = useState<RacerState[]>([]);
  const [countdownLabel, setCountdownLabel] = useState('');

  const currentWorld = WORLDS[selectedWorld];
  const ranking = [...hudData].sort(compareRacers);

  const racersRef = useRef<RacerState[]>(createInitialRacers('single'));
  const obstaclesRef = useRef<ObstacleData[]>(createObstacles(currentWorld.trackLength));
  const starsRef = useRef<StarData[]>(createStars(currentWorld.trackLength));
  const powerUpsRef = useRef<PowerUpBoxData[]>(createPowerUps(currentWorld.trackLength));
  const raceRef = useRef<RaceState>(createRace());
  const lastHudUpdateRef = useRef(0);
  const resultsScheduledRef = useRef(false);

  useEffect(() => {
    const checkGamepads = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const count = Array.from(pads).filter(Boolean).length;
      setGamepadCount(count);
    };
    const interval = setInterval(checkGamepads, 1000);
    window.addEventListener('gamepadconnected', checkGamepads);
    window.addEventListener('gamepaddisconnected', checkGamepads);
    return () => {
      clearInterval(interval);
      window.removeEventListener('gamepadconnected', checkGamepads);
      window.removeEventListener('gamepaddisconnected', checkGamepads);
    };
  }, []);

  const startGame = (selectedMode: 'single' | 'multi') => {
    const worldCfg = WORLDS[selectedWorld];
    setMode(selectedMode);
    racersRef.current = createInitialRacers(selectedMode);
    obstaclesRef.current = createObstacles(worldCfg.trackLength);
    starsRef.current = createStars(worldCfg.trackLength);
    powerUpsRef.current = createPowerUps(worldCfg.trackLength);
    raceRef.current = createRace();
    lastHudUpdateRef.current = 0;
    resultsScheduledRef.current = false;
    setCountdownLabel('3');
    setHudData([...racersRef.current]);
    setScreen('playing');
  };

  const handleRaceUpdate = () => {
    // نص العدّ التنازلي (إعادة نفس القيمة لا تسبب إعادة رسم)
    const race = raceRef.current;
    const label = !race.started
      ? String(Math.ceil(race.countdown))
      : race.goTimer > 0
      ? 'انطلق!'
      : '';
    setCountdownLabel(label);

    // تحديث الواجهة 10 مرات في الثانية فقط بدل 60 لتحسين الأداء
    const now = performance.now();
    if (now - lastHudUpdateRef.current > 100) {
      lastHudUpdateRef.current = now;
      setHudData([...racersRef.current]);
    }

    // الانتقال لشاشة النتائج مرة واحدة فقط
    const humanRacers = racersRef.current.filter((r) => !r.isBot);
    if (!resultsScheduledRef.current && humanRacers.every((r) => r.finished)) {
      resultsScheduledRef.current = true;
      setHudData([...racersRef.current]);
      setTimeout(() => setScreen('results'), 600);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', direction: 'rtl' }}>
      {/* شاشة البداية الحديثة */}
      {screen === 'menu' && (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            padding: '1.5rem',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              padding: '0.5rem 1.3rem',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '1rem',
              fontWeight: 'bold',
              fontSize: '0.95rem',
            }}
          >
            <Gamepad2 size={20} />
            <span>
              {gamepadCount > 0
                ? `تم اكتشاف ${gamepadCount} ذراع تحكم (جويستيك) جاهزة!`
                : 'وصّل الجويستيك أو العب بلوحة المفاتيح'}
            </span>
          </div>

          <h1
            style={{
              fontSize: '3.2rem',
              fontWeight: 900,
              marginBottom: '0.35rem',
              textShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            Turbo Kids Dash
          </h1>
          <p style={{ fontSize: '1.15rem', opacity: 0.92, marginBottom: '1.8rem' }}>
            اختر عالم السباق وابدأ التحدي!
          </p>

          {/* بطاقات اختيار العالم */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginBottom: '2rem',
              maxWidth: '820px',
              width: '100%',
            }}
          >
            {WORLD_LIST.map((w) => {
              const isSelected = selectedWorld === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorld(w.id)}
                  style={{
                    flex: '1 1 230px',
                    background: isSelected ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 23, 42, 0.35)',
                    color: isSelected ? '#0f172a' : 'white',
                    border: isSelected ? '4px solid #facc15' : '2px solid rgba(255,255,255,0.25)',
                    borderRadius: '1.2rem',
                    padding: '1.1rem',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'transform 0.15s ease',
                    transform: isSelected ? 'translateY(-4px)' : 'none',
                    boxShadow: isSelected ? '0 10px 25px rgba(0,0,0,0.25)' : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.45rem',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', fontWeight: 900 }}>{w.name}</span>
                    <span
                      style={{
                        background: w.badgeColor,
                        color: 'white',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <MapPin size={13} /> {w.trackLength}م
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', opacity: isSelected ? 0.8 : 0.88 }}>
                    {w.subtitle}
                  </div>
                </button>
              );
            })}
          </div>

          {/* اختيار مستوى الصعوبة */}
          <div style={{ marginBottom: '1.8rem', textAlign: 'center' }}>
            <div
              style={{
                display: 'flex',
                gap: '0.7rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '0.6rem',
              }}
            >
              <span style={{ fontWeight: 'bold' }}>مستوى الصعوبة:</span>
              {DIFFICULTY_LIST.map((d) => {
                const isSelected = difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    style={{
                      background: isSelected ? '#facc15' : 'rgba(15, 23, 42, 0.35)',
                      color: isSelected ? '#1e293b' : 'white',
                      border: isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.25)',
                      padding: '0.5rem 1.4rem',
                      borderRadius: '999px',
                      fontSize: '1rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{DIFFICULTIES[difficulty].subtitle}</div>
          </div>

          {/* أزرار بدء اللعب الفردي أو الثنائي */}
          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => startGame('single')}
              style={{
                background: '#facc15',
                color: '#1e293b',
                border: 'none',
                padding: '1.1rem 2.2rem',
                borderRadius: '1.2rem',
                fontSize: '1.25rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
              }}
            >
              <User size={25} />
              <span>لعب فردي (ضد الذكاء الاصطناعي)</span>
            </button>

            <button
              onClick={() => startGame('multi')}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '1.1rem 2.2rem',
                borderRadius: '1.2rem',
                fontSize: '1.25rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
              }}
            >
              <Users size={25} />
              <span>لعب ثنائي (شاشة منقسمة)</span>
            </button>
          </div>

          <div
            style={{
              marginTop: '2rem',
              background: 'rgba(15, 23, 42, 0.45)',
              padding: '0.9rem 1.8rem',
              borderRadius: '1rem',
              fontSize: '0.9rem',
              lineHeight: 1.75,
              textAlign: 'center',
            }}
          >
            <div>
              <strong>الجويستيك:</strong> العصا للحركة | A قفز | B اندفاع | X أو Y لتفعيل المفاجأة
            </div>
            <div>
              <strong>لوحة المفاتيح:</strong> لاعب 1 (WASD + Space قفز + Shift اندفاع + E مفاجأة) | لاعب 2 (الأسهم + Enter قفز + Right Shift اندفاع + Right Ctrl مفاجأة)
            </div>
          </div>
        </div>
      )}

      {/* شاشة اللعب */}
      {screen === 'playing' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              {hudData.slice(0, mode === 'multi' ? 2 : 1).map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.82)',
                    color: 'white',
                    padding: '0.55rem 1.1rem',
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    borderRight: `5px solid ${p.color}`,
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#facc15' }}>
                    <Star size={18} fill="#facc15" /> {p.stars}
                  </span>
                  <span style={{ fontWeight: 'bold', color: '#4ade80' }}>
                    المركز {ranking.findIndex((r) => r.id === p.id) + 1}/{ranking.length}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: p.heldPowerUp ? '#9333ea' : 'rgba(255,255,255,0.12)',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '0.6rem',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    <Zap size={15} />
                    {p.heldPowerUp ? POWERUP_LABELS[p.heldPowerUp] : 'لا توجد مفاجأة'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  background: 'rgba(15, 23, 42, 0.82)',
                  color: 'white',
                  padding: '0.55rem 1rem',
                  borderRadius: '0.75rem',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  direction: 'ltr',
                }}
              >
                <Timer size={16} /> {formatTime(raceRef.current.elapsed)}
              </span>
              <span
                style={{
                  background: currentWorld.badgeColor,
                  color: 'white',
                  padding: '0.55rem 1rem',
                  borderRadius: '0.75rem',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}
              >
                {currentWorld.name}
              </span>
              <button
                onClick={() => setScreen('menu')}
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: 'white',
                  border: 'none',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                القائمة الرئيسية
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              height: '100%',
              borderLeft: mode === 'multi' ? '3px solid #1e293b' : 'none',
            }}
          >
            <Canvas shadows camera={{ fov: 55 }}>
              <GameScene
                mode={mode}
                world={currentWorld}
                cameraTargetIndex={0}
                racersRef={racersRef}
                obstaclesRef={obstaclesRef}
                starsRef={starsRef}
                powerUpsRef={powerUpsRef}
                raceRef={raceRef}
                difficulty={difficulty}
                onRaceUpdate={handleRaceUpdate}
                isMasterScene={true}
              />
            </Canvas>
          </div>

          {mode === 'multi' && (
            <div style={{ flex: 1, height: '100%' }}>
              <Canvas shadows camera={{ fov: 55 }}>
                <GameScene
                  mode={mode}
                  world={currentWorld}
                  cameraTargetIndex={1}
                  racersRef={racersRef}
                  obstaclesRef={obstaclesRef}
                  starsRef={starsRef}
                  powerUpsRef={powerUpsRef}
                  raceRef={raceRef}
                  difficulty={difficulty}
                  onRaceUpdate={handleRaceUpdate}
                  isMasterScene={false}
                />
              </Canvas>
            </div>
          )}
        </div>
      )}

      {/* العدّ التنازلي قبل الانطلاق */}
      {screen === 'playing' && countdownLabel !== '' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: '9rem',
              fontWeight: 900,
              color: countdownLabel === 'انطلق!' ? '#22c55e' : '#facc15',
              textShadow: '0 8px 30px rgba(0,0,0,0.45)',
            }}
          >
            {countdownLabel}
          </span>
        </div>
      )}

      {/* شاشة النتائج ومنصة التتويج */}
      {screen === 'results' && (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <Trophy size={64} color="#facc15" style={{ marginBottom: '0.8rem' }} />
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.4rem' }}>
            نتائج السباق!
          </h2>
          <p style={{ opacity: 0.85, marginBottom: '1.8rem' }}>
            {currentWorld.name} — {DIFFICULTIES[difficulty].name}
          </p>

          <div
            style={{
              width: '100%',
              maxWidth: '500px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8rem',
              marginBottom: '2rem',
            }}
          >
            {[...hudData]
              .sort(compareRacers)
              .map((r, index) => (
                <div
                  key={r.id}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    padding: '1rem 1.5rem',
                    borderRadius: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRight: `6px solid ${r.color}`,
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    #{index + 1} — {r.name}
                    <span
                      style={{
                        opacity: 0.7,
                        fontWeight: 'normal',
                        fontSize: '0.9rem',
                        marginInlineStart: '0.7rem',
                      }}
                    >
                      {r.finished ? `${r.finishTime.toFixed(2)} ث` : 'لم يصل'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: '#facc15',
                      fontWeight: 'bold',
                    }}
                  >
                    <Star size={18} fill="#facc15" /> {r.stars} نجمة
                  </div>
                </div>
              ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => startGame(mode)}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '1rem 2.2rem',
                borderRadius: '1rem',
                fontSize: '1.15rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <RotateCcw size={21} />
              <span>إعادة السباق</span>
            </button>

            <button
              onClick={() => setScreen('menu')}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '1rem',
                fontSize: '1.15rem',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              تغيير العالم
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;