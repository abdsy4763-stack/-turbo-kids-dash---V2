import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Character } from './Character';
import {
  Track,
  type ObstacleData,
  type StarData,
  type PowerUpBoxData,
  type PowerUpType,
  type RaceState,
} from './Track';
import type { WorldConfig } from '../config/worlds';
import { useInputManager } from '../input/useInputManager';
import { useSoundEffects } from '../audio/useSoundEffects';
import {
  computeBotInput,
  DIFFICULTIES,
  type BotPersonality,
  type BotPlan,
  type DifficultyId,
} from '../ai/botAI';

export type RacerState = {
  id: number;
  name: string;
  color: string;
  isBot: boolean;
  pos: [number, number, number];
  velY: number;
  rotY: number;
  isGrounded: boolean;
  isDashing: boolean;
  dashCooldown: number;
  dashTimer: number; // الثواني المتبقية من الاندفاع الحالي
  hitTimer: number; // الثواني المتبقية من الحماية بعد الاصطدام
  heldPowerUp: PowerUpType | null;
  shieldTimer: number;
  superJumpTimer: number;
  stars: number;
  finished: boolean;
  finishTime: number;
  // بيانات عقل الروبوت (لا تُستخدم للاعبين البشر)
  personality: BotPersonality;
  aiTimer: number;
  aiTargetX: number | null;
  aiPlan: BotPlan;
  aiJumpLead: number;
};

interface GameSceneProps {
  mode: 'single' | 'multi';
  world: WorldConfig;
  cameraTargetIndex: 0 | 1;
  racersRef: React.MutableRefObject<RacerState[]>;
  obstaclesRef: React.MutableRefObject<ObstacleData[]>;
  starsRef: React.MutableRefObject<StarData[]>;
  powerUpsRef: React.MutableRefObject<PowerUpBoxData[]>;
  raceRef: React.MutableRefObject<RaceState>;
  difficulty: DifficultyId;
  onRaceUpdate: () => void;
  isMasterScene?: boolean;
}

const POWERUP_POOL: PowerUpType[] = ['turbo', 'shield', 'superJump'];

// ثوابت يمكنك تعديلها بسهولة لضبط إحساس اللعب
const DASH_DURATION = 0.45; // مدة الاندفاع العادي
const TURBO_DURATION = 1.4; // مدة صاروخ التوربو
const HIT_PROTECTION = 1.0; // ثانية حماية بعد الاصطدام
const HIT_PUSHBACK = 2.2; // مسافة الارتداد للخلف عند الاصطدام

export const GameScene: React.FC<GameSceneProps> = ({
  world,
  cameraTargetIndex,
  racersRef,
  obstaclesRef,
  starsRef,
  powerUpsRef,
  raceRef,
  difficulty,
  onRaceUpdate,
  isMasterScene = true,
}) => {
  const { camera } = useThree();
  const { getPlayerInput, triggerVibration } = useInputManager();
  const { playSound } = useSoundEffects();
  const [, setTick] = useState(0);
  const lastTickSecondRef = useRef(0);

  const trackLength = world.trackLength;

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05);
    const race = raceRef.current;

    if (isMasterScene) {
      if (!race.started) {
        // مرحلة العدّ التنازلي: السباقون ثابتون في أماكنهم
        const second = Math.ceil(race.countdown);
        if (second !== lastTickSecondRef.current) {
          lastTickSecondRef.current = second;
          playSound('tick');
        }
        race.countdown -= dt;
        if (race.countdown <= 0) {
          race.started = true;
          race.goTimer = 0.9;
          playSound('go');
        }
      } else {
        race.elapsed += dt;
        if (race.goTimer > 0) race.goTimer = Math.max(0, race.goTimer - dt);

        racersRef.current.forEach((racer, idx) => {
          if (racer.finished) return;

          let moveX = 0;
          let moveZ = 0;
          let wantJump = false;
          let wantDash = false;
          let wantPower = false;

          if (!racer.isBot) {
            const input = getPlayerInput(idx as 0 | 1);
            moveX = input.moveX;
            moveZ = input.moveZ;
            wantJump = input.jump;
            wantDash = input.dash;
            wantPower = input.power;
          } else {
            // عقل الروبوت: يقرر الحركة والقفز والاندفاع حسب الصعوبة والشخصية
            const ai = computeBotInput(racer, {
              dt,
              difficulty: DIFFICULTIES[difficulty],
              raceTime: race.elapsed,
              obstacleSpeedMultiplier: world.obstacleSpeedMultiplier,
              obstacles: obstaclesRef.current,
              stars: starsRef.current,
              powerUps: powerUpsRef.current,
              racers: racersRef.current,
            });
            moveX = ai.moveX;
            moveZ = ai.moveZ;
            wantJump = ai.jump;
            wantDash = ai.dash;
            wantPower = ai.power;
          }

          // عدادات القدرات النشطة
          if (racer.shieldTimer > 0) racer.shieldTimer = Math.max(0, racer.shieldTimer - dt);
          if (racer.superJumpTimer > 0) {
            racer.superJumpTimer = Math.max(0, racer.superJumpTimer - dt);
          }
          if (racer.hitTimer > 0) racer.hitTimer = Math.max(0, racer.hitTimer - dt);
          if (racer.dashTimer > 0) racer.dashTimer = Math.max(0, racer.dashTimer - dt);
          if (racer.dashCooldown > 0) racer.dashCooldown -= dt;

          // تفعيل القدرة المحفوظة عند الضغط على زر القدرة
          if (wantPower && racer.heldPowerUp) {
            const used = racer.heldPowerUp;
            racer.heldPowerUp = null;
            if (!racer.isBot) {
              playSound('usePower');
              triggerVibration(idx as 0 | 1, 140, 0.65);
            }

            if (used === 'turbo') {
              racer.dashTimer = Math.max(racer.dashTimer, TURBO_DURATION);
            } else if (used === 'shield') {
              racer.shieldTimer = 5.5;
            } else if (used === 'superJump') {
              racer.superJumpTimer = 6.0;
            }
          }

          // الاندفاع العادي (Dash)
          if (wantDash && racer.dashCooldown <= 0) {
            racer.dashTimer = Math.max(racer.dashTimer, DASH_DURATION);
            racer.dashCooldown = 2.5;
            if (!racer.isBot) {
              playSound('dash');
              triggerVibration(idx as 0 | 1, 150, 0.6);
            }
          }

          // حالة الاندفاع تُشتق من المؤقّت، فلا يتعارض الاندفاع مع التوربو
          racer.isDashing = racer.dashTimer > 0;

          const speed = racer.isDashing ? 18.5 : 10.5;
          racer.pos[0] += moveX * speed * dt;
          racer.pos[2] += moveZ * speed * dt;

          racer.pos[0] = THREE.MathUtils.clamp(racer.pos[0], -5.2, 5.2);
          racer.pos[2] = Math.min(racer.pos[2], 3);

          if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
            racer.rotY = Math.atan2(moveX, moveZ);
          }

          // القفز والجاذبية (مع دعم القفزة الفائقة)
          if (wantJump && racer.isGrounded) {
            racer.velY = racer.superJumpTimer > 0 ? 15.5 : 10.5;
            racer.isGrounded = false;
            if (!racer.isBot) {
              playSound('jump');
              triggerVibration(idx as 0 | 1, 80, 0.3);
            }
          }

          racer.pos[1] += racer.velY * dt;
          if (racer.pos[1] > 0) {
            racer.velY -= 26 * dt;
          } else {
            racer.pos[1] = 0;
            racer.velY = 0;
            racer.isGrounded = true;
          }

          // الاصطدام بالعقبات: ارتداد واحد ثم ثانية حماية (الدرع يمنع الاصطدام كليًا)
          if (racer.hitTimer <= 0 && racer.shieldTimer <= 0) {
            for (const obs of obstaclesRef.current) {
              const dx = racer.pos[0] - obs.currentX;
              const dz = racer.pos[2] - obs.z;
              const dist = Math.sqrt(dx * dx + dz * dz);
              if (dist < 1.35 && racer.pos[1] < 1.4) {
                racer.pos[2] = Math.min(racer.pos[2] + HIT_PUSHBACK, 3);
                racer.hitTimer = HIT_PROTECTION;
                if (!racer.isBot) {
                  playSound('hit');
                  triggerVibration(idx as 0 | 1, 200, 0.8);
                }
                break;
              }
            }
          }

          // جمع النجوم الذهبية
          starsRef.current.forEach((star) => {
            if (!star.collectedBy.includes(racer.id)) {
              const dx = racer.pos[0] - star.x;
              const dz = racer.pos[2] - star.z;
              if (Math.sqrt(dx * dx + dz * dz) < 1.1) {
                star.collectedBy.push(racer.id);
                racer.stars += 1;
                if (!racer.isBot) {
                  playSound('star');
                  triggerVibration(idx as 0 | 1, 60, 0.25);
                }
              }
            }
          });

          // التقاط صناديق المفاجآت
          powerUpsRef.current.forEach((box) => {
            if (!box.collectedBy.includes(racer.id)) {
              const dx = racer.pos[0] - box.x;
              const dz = racer.pos[2] - box.z;
              if (Math.sqrt(dx * dx + dz * dz) < 1.25 && racer.pos[1] < 1.8) {
                box.collectedBy.push(racer.id);
                if (!racer.heldPowerUp) {
                  const randomPower =
                    POWERUP_POOL[Math.floor(Math.random() * POWERUP_POOL.length)];
                  racer.heldPowerUp = randomPower;
                  if (!racer.isBot) {
                    playSound('powerup');
                    triggerVibration(idx as 0 | 1, 100, 0.45);
                  }
                }
              }
            }
          });

          // الوصول لخط النهاية (زمن الوصول يُحسب من لحظة الانطلاق)
          if (racer.pos[2] <= -trackLength) {
            racer.finished = true;
            racer.isDashing = false;
            racer.hitTimer = 0;
            racer.finishTime = Number(race.elapsed.toFixed(2));
            if (!racer.isBot) {
              playSound('finish');
            }
          }
        });
      }

      onRaceUpdate();
    }

    const target = racersRef.current[cameraTargetIndex];
    if (target) {
      const desiredPos = new THREE.Vector3(
        target.pos[0] * 0.6,
        target.pos[1] + 5.2,
        target.pos[2] + 8.5
      );
      camera.position.lerp(desiredPos, 0.12);
      camera.lookAt(target.pos[0] * 0.5, target.pos[1] + 1, target.pos[2] - 4);
    }

    setTick((t) => (t + 1) % 1000);
  });

  return (
    <>
      <color attach="background" args={[world.skyColor]} />
      <fog attach="fog" args={[world.skyColor, 28, 95]} />

      <ambientLight intensity={world.id === 'space' ? 0.65 : 0.75} />
      <directionalLight
        position={[15, 25, 10]}
        intensity={world.id === 'space' ? 1.5 : 1.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <Track
        world={world}
        obstaclesRef={obstaclesRef}
        stars={starsRef.current}
        powerUps={powerUpsRef.current}
        raceRef={raceRef}
        viewerIndex={cameraTargetIndex}
      />

      {racersRef.current.map((racer) => (
        <Character
          key={racer.id}
          position={racer.pos}
          rotationY={racer.rotY}
          color={racer.color}
          isDashing={racer.isDashing}
          isGrounded={racer.isGrounded}
          hasShield={racer.shieldTimer > 0}
          isHit={racer.hitTimer > 0}
        />
      ))}
    </>
  );
};