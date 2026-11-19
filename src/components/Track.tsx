import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldConfig } from '../config/worlds';

export type ObstacleData = {
  id: number;
  z: number;
  speed: number;
  range: number;
  currentX: number;
};

export type StarData = {
  id: number;
  x: number;
  z: number;
  collectedBy: number[];
};

export type PowerUpType = 'turbo' | 'shield' | 'superJump';

export type PowerUpBoxData = {
  id: number;
  x: number;
  z: number;
  collectedBy: number[];
};

// حالة السباق المشتركة بين كل الشاشات (العدّ التنازلي + زمن السباق)
export type RaceState = {
  countdown: number; // الثواني المتبقية للانطلاق
  started: boolean; // هل بدأ السباق؟
  elapsed: number; // زمن السباق منذ لحظة الانطلاق
  goTimer: number; // مدة إظهار كلمة "انطلق!"
};

interface TrackProps {
  world: WorldConfig;
  obstaclesRef: React.MutableRefObject<ObstacleData[]>;
  stars: StarData[];
  powerUps: PowerUpBoxData[];
  raceRef: React.MutableRefObject<RaceState>;
  viewerIndex: number; // رقم اللاعب الذي تعرض له هذه الشاشة
}

const TrackInner: React.FC<TrackProps> = ({
  world,
  obstaclesRef,
  stars,
  powerUps,
  raceRef,
  viewerIndex,
}) => {
  const obstacleMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const starMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const boxMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const decorMeshes = useRef<(THREE.Mesh | null)[]>([]);

  const trackLength = world.trackLength;

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    // حركة العقبات تعتمد على زمن السباق المشترك، فتبقى متطابقة في الشاشتين
    const raceTime = raceRef.current.elapsed;

    obstaclesRef.current.forEach((obs, idx) => {
      obs.currentX =
        Math.sin(raceTime * obs.speed * world.obstacleSpeedMultiplier + obs.id) * obs.range;
      const mesh = obstacleMeshes.current[idx];
      if (mesh) {
        mesh.position.x = obs.currentX;
        mesh.rotation.y += delta * 2.4;
      }
    });

    // النجمة تختفي عند اللاعب الذي جمعها
    starMeshes.current.forEach((mesh, i) => {
      if (mesh) {
        mesh.rotation.y += delta * 3;
        mesh.visible = !stars[i].collectedBy.includes(viewerIndex);
      }
    });

    // صندوق المفاجآت يختفي عند اللاعب الذي التقطه
    boxMeshes.current.forEach((mesh, i) => {
      if (mesh) {
        mesh.rotation.y += delta * 2.7;
        mesh.rotation.x += delta * 1.2;
        mesh.position.y = 0.95 + Math.sin(t * 4 + i) * 0.15;
        mesh.visible = !powerUps[i].collectedBy.includes(viewerIndex);
      }
    });

    decorMeshes.current.forEach((mesh, i) => {
      if (mesh) {
        mesh.position.y = (world.id === 'space' ? 4.5 : 1.5) + Math.sin(t * 2 + i) * 0.4;
        mesh.rotation.y += delta * 0.9;
      }
    });
  });

  const decorCount = Math.floor(trackLength / 22);

  return (
    <group>
      {/* أرضية المضمار الرئيسية */}
      <mesh position={[0, -0.5, -trackLength / 2 + 5]} receiveShadow>
        <boxGeometry args={[12, 1, trackLength + 10]} />
        <meshStandardMaterial color={world.trackColor} roughness={0.35} />
      </mesh>

      {/* حواف المضمار الملونة */}
      <mesh position={[-6.2, 0.25, -trackLength / 2 + 5]} receiveShadow>
        <boxGeometry args={[0.5, 1.5, trackLength + 10]} />
        <meshStandardMaterial color={world.borderColor} />
      </mesh>
      <mesh position={[6.2, 0.25, -trackLength / 2 + 5]} receiveShadow>
        <boxGeometry args={[0.5, 1.5, trackLength + 10]} />
        <meshStandardMaterial color={world.borderColor} />
      </mesh>

      {/* خطوط المسار */}
      {Array.from({ length: Math.floor(trackLength / 10) }).map((_, i) => (
        <mesh
          key={i}
          position={[0, 0.01, -i * 10]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[11, 0.4]} />
          <meshStandardMaterial color={world.stripeColor} />
        </mesh>
      ))}

      {/* زينة جانبية تختلف حسب العالم */}
      {Array.from({ length: decorCount }).map((_, i) => {
        const zPos = -(i + 1) * 20;
        const side = i % 2 === 0 ? -9.5 : 9.5;
        const decorColor =
          world.id === 'pirate'
            ? '#38bdf8'
            : world.id === 'space'
            ? '#f472b6'
            : '#facc15';

        return (
          <mesh
            key={i}
            ref={(el) => {
              decorMeshes.current[i] = el;
            }}
            position={[side, world.id === 'space' ? 4.5 : 1.5, zPos]}
            castShadow
          >
            {world.id === 'space' ? (
              <octahedronGeometry args={[1.2, 1]} />
            ) : (
              <dodecahedronGeometry args={[1.0, 0]} />
            )}
            <meshStandardMaterial
              color={decorColor}
              emissive={world.id === 'space' ? decorColor : '#000000'}
              emissiveIntensity={world.id === 'space' ? 0.35 : 0}
              roughness={0.3}
            />
          </mesh>
        );
      })}

      {/* العقبات المتحركة */}
      {obstaclesRef.current.map((obs, idx) => (
        <mesh
          key={obs.id}
          ref={(el) => {
            obstacleMeshes.current[idx] = el;
          }}
          position={[0, 0.85, obs.z]}
          castShadow
        >
          <cylinderGeometry args={[0.9, 0.9, 1.7, 20]} />
          <meshStandardMaterial color={world.obstacleColor} roughness={0.25} />
        </mesh>
      ))}

      {/* النجوم الذهبية */}
      {stars.map((star, idx) => (
        <mesh
          key={star.id}
          ref={(el) => {
            starMeshes.current[idx] = el;
          }}
          position={[star.x, 0.9, star.z]}
          castShadow
        >
          <octahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#eab308"
            emissiveIntensity={0.45}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* صناديق المفاجآت */}
      {powerUps.map((box, idx) => (
        <mesh
          key={box.id}
          ref={(el) => {
            boxMeshes.current[idx] = el;
          }}
          position={[box.x, 0.95, box.z]}
          castShadow
        >
          <boxGeometry args={[0.85, 0.85, 0.85]} />
          <meshStandardMaterial
            color="#c084fc"
            emissive="#9333ea"
            emissiveIntensity={0.55}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* خط النهاية */}
      <group position={[0, 0, -trackLength]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 3]} />
          <meshStandardMaterial color="#10b981" />
        </mesh>
        <mesh position={[-5.5, 2.5, 0]} castShadow>
          <boxGeometry args={[0.6, 5, 0.6]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
        <mesh position={[5.5, 2.5, 0]} castShadow>
          <boxGeometry args={[0.6, 5, 0.6]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
        <mesh position={[0, 4.8, 0]} castShadow>
          <boxGeometry args={[11.6, 0.8, 0.6]} />
          <meshStandardMaterial color="#10b981" />
        </mesh>
      </group>
    </group>
  );
};

// React.memo: لا يُعاد رسم المضمار كل إطار، فقط حين تتغير خصائصه (وهي ثابتة عمليًا)
export const Track = React.memo(TrackInner);