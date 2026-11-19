import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CharacterProps {
  position: [number, number, number];
  rotationY: number;
  color: string;
  isDashing: boolean;
  isGrounded: boolean;
  hasShield?: boolean;
  isHit?: boolean;
}

export const Character: React.FC<CharacterProps> = ({
  position,
  rotationY,
  color,
  isDashing,
  isGrounded,
  hasShield = false,
  isHit = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!groupRef.current || !bodyRef.current) return;
    groupRef.current.position.set(position[0], position[1], position[2]);
    groupRef.current.rotation.y = rotationY;
    // وميض الشخصية أثناء فترة الحماية بعد الاصطدام
    groupRef.current.visible = !isHit || Math.floor(state.clock.elapsedTime * 16) % 2 === 0;

    const t = state.clock.elapsedTime * 12;
    const bounce = isGrounded ? Math.abs(Math.sin(t)) * 0.08 : 0.15;
    bodyRef.current.scale.set(
      isGrounded ? 1 : 0.9,
      1 + bounce,
      isGrounded ? 1 : 0.9
    );
  });

  return (
    <group ref={groupRef}>
      {/* ظل دائري أسفل الشخصية */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} />
      </mesh>

      {/* فقاعة الدرع الواقي عند التفعيل */}
      {hasShield && (
        <mesh position={[0, 0.85, 0]}>
          <sphereGeometry args={[0.95, 24, 24]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.32}
            roughness={0.1}
          />
        </mesh>
      )}

      {/* جسم الشخصية */}
      <mesh ref={bodyRef} position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.55, 12, 24]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
      </mesh>

      {/* العيون الكرتونية */}
      <group position={[0, 0.95, 0.36]}>
        <mesh position={[-0.15, 0, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.15, 0, 0.07]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>

        <mesh position={[0.15, 0, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.15, 0, 0.07]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>

      {/* حقيبة التوربو الخلفية */}
      <mesh position={[0, 0.75, -0.4]} castShadow>
        <boxGeometry args={[0.45, 0.5, 0.25]} />
        <meshStandardMaterial
          color={isDashing ? '#f59e0b' : '#334155'}
          emissive={isDashing ? '#f59e0b' : '#000000'}
          emissiveIntensity={isDashing ? 1.5 : 0}
        />
      </mesh>
    </group>
  );
};