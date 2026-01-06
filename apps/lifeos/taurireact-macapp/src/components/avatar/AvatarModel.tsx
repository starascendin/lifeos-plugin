// @ts-nocheck - R3F v9 RC has type resolution issues with pnpm
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, Capsule, Cylinder, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { LifeCategory } from "@/lib/contexts/AvatarContext";

interface AvatarModelProps {
  stats: Record<LifeCategory, number>;
}

// Calculate color based on stat values
function getBodyColor(stats: Record<LifeCategory, number>): string {
  // Health affects color saturation
  const healthFactor = stats.health / 100;
  // Base is a pleasant blue-purple
  const hue = 220 + (stats.social / 100) * 30; // Shifts slightly with social
  const saturation = 40 + healthFactor * 40; // 40-80% based on health
  const lightness = 50 + (stats.work / 100) * 15; // 50-65% based on work
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Calculate aura color based on learning
function getAuraColor(learning: number): string {
  const intensity = learning / 100;
  return `hsl(${140 + intensity * 20}, ${60 + intensity * 30}%, ${50 + intensity * 20}%)`;
}

export function AvatarModel({ stats }: AvatarModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  // Calculate colors
  const bodyColor = useMemo(() => getBodyColor(stats), [stats]);
  const auraColor = useMemo(() => getAuraColor(stats.learning), [stats.learning]);

  // Calculate scale based on stats (subtle variation)
  const overallScale = useMemo(() => {
    const avg = (stats.health + stats.work + stats.social + stats.learning + stats.finance) / 5;
    return 0.9 + (avg / 100) * 0.2; // Scale between 0.9 and 1.1
  }, [stats]);

  // Calculate smile width based on social
  const smileWidth = useMemo(() => {
    return 0.1 + (stats.social / 100) * 0.15; // 0.1 to 0.25
  }, [stats.social]);

  // Calculate eye size based on learning (curiosity)
  const eyeScale = useMemo(() => {
    return 0.8 + (stats.learning / 100) * 0.4; // 0.8 to 1.2
  }, [stats.learning]);

  // Idle animation
  useFrame((state) => {
    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
    }

    if (bodyRef.current) {
      // Subtle breathing animation
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.02;
      bodyRef.current.scale.setScalar(breathe);
    }

    if (auraRef.current) {
      // Pulsing aura based on learning stat
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1 * (stats.learning / 100);
      auraRef.current.scale.setScalar(pulse);
      // Rotate aura
      auraRef.current.rotation.y += 0.005;
    }
  });

  // Finance affects golden accent visibility
  const showGoldenAccent = stats.finance > 50;
  const goldenIntensity = (stats.finance - 50) / 50; // 0 to 1 when finance > 50

  return (
    <group ref={groupRef} scale={overallScale}>
      {/* Aura (visible when learning is high) */}
      {stats.learning > 30 && (
        <mesh ref={auraRef} position={[0, 0.5, 0]}>
          <sphereGeometry args={[1.8, 32, 32]} />
          <meshBasicMaterial
            color={auraColor}
            transparent
            opacity={(stats.learning / 100) * 0.15}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Body - Capsule shape */}
      <group position={[0, 0, 0]}>
        <Capsule ref={bodyRef} args={[0.5, 1, 16, 32]} position={[0, 0.5, 0]}>
          <meshToonMaterial color={bodyColor} />
        </Capsule>

        {/* Golden accent belt (finance indicator) */}
        {showGoldenAccent && (
          <Cylinder args={[0.52, 0.52, 0.1, 32]} position={[0, 0.2, 0]}>
            <meshStandardMaterial
              color="#fbbf24"
              metalness={0.8}
              roughness={0.2}
              emissive="#fbbf24"
              emissiveIntensity={goldenIntensity * 0.3}
            />
          </Cylinder>
        )}
      </group>

      {/* Head */}
      <Sphere args={[0.45, 32, 32]} position={[0, 1.55, 0]}>
        <meshToonMaterial color={bodyColor} />
      </Sphere>

      {/* Face */}
      <group position={[0, 1.55, 0.35]}>
        {/* Eyes */}
        <group scale={eyeScale}>
          {/* Left eye */}
          <Sphere args={[0.08, 16, 16]} position={[-0.15, 0.05, 0]}>
            <meshBasicMaterial color="white" />
          </Sphere>
          <Sphere args={[0.04, 16, 16]} position={[-0.15, 0.05, 0.05]}>
            <meshBasicMaterial color="#1a1a2e" />
          </Sphere>

          {/* Right eye */}
          <Sphere args={[0.08, 16, 16]} position={[0.15, 0.05, 0]}>
            <meshBasicMaterial color="white" />
          </Sphere>
          <Sphere args={[0.04, 16, 16]} position={[0.15, 0.05, 0.05]}>
            <meshBasicMaterial color="#1a1a2e" />
          </Sphere>
        </group>

        {/* Smile - uses a thin box scaled for width */}
        <RoundedBox
          args={[smileWidth * 2, 0.03, 0.02]}
          radius={0.01}
          position={[0, -0.12, 0]}
        >
          <meshBasicMaterial color="#1a1a2e" />
        </RoundedBox>

        {/* Cheeks (blush when social is high) */}
        {stats.social > 60 && (
          <>
            <Sphere args={[0.06, 16, 16]} position={[-0.25, -0.05, -0.05]}>
              <meshBasicMaterial
                color="#ff6b6b"
                transparent
                opacity={(stats.social - 60) / 80}
              />
            </Sphere>
            <Sphere args={[0.06, 16, 16]} position={[0.25, -0.05, -0.05]}>
              <meshBasicMaterial
                color="#ff6b6b"
                transparent
                opacity={(stats.social - 60) / 80}
              />
            </Sphere>
          </>
        )}
      </group>

      {/* Arms */}
      <group>
        {/* Left arm */}
        <Cylinder
          args={[0.1, 0.08, 0.6, 16]}
          position={[-0.65, 0.5, 0]}
          rotation={[0, 0, Math.PI / 6]}
        >
          <meshToonMaterial color={bodyColor} />
        </Cylinder>

        {/* Right arm */}
        <Cylinder
          args={[0.1, 0.08, 0.6, 16]}
          position={[0.65, 0.5, 0]}
          rotation={[0, 0, -Math.PI / 6]}
        >
          <meshToonMaterial color={bodyColor} />
        </Cylinder>
      </group>

      {/* Legs */}
      <group>
        {/* Left leg */}
        <Cylinder
          args={[0.12, 0.1, 0.7, 16]}
          position={[-0.2, -0.85, 0]}
        >
          <meshToonMaterial color={bodyColor} />
        </Cylinder>

        {/* Right leg */}
        <Cylinder
          args={[0.12, 0.1, 0.7, 16]}
          position={[0.2, -0.85, 0]}
        >
          <meshToonMaterial color={bodyColor} />
        </Cylinder>
      </group>

      {/* Feet */}
      <group>
        <RoundedBox args={[0.18, 0.1, 0.25]} radius={0.03} position={[-0.2, -1.25, 0.05]}>
          <meshToonMaterial color={bodyColor} />
        </RoundedBox>
        <RoundedBox args={[0.18, 0.1, 0.25]} radius={0.03} position={[0.2, -1.25, 0.05]}>
          <meshToonMaterial color={bodyColor} />
        </RoundedBox>
      </group>
    </group>
  );
}
