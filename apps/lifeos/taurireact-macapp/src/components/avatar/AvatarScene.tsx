// @ts-nocheck - R3F v9 RC has type resolution issues with pnpm
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from "@react-three/drei";
import { Suspense } from "react";
import { AvatarModel } from "./AvatarModel";
import { useAvatar } from "@/lib/contexts/AvatarContext";

function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshBasicMaterial color="#888" wireframe />
    </mesh>
  );
}

interface AvatarSceneProps {
  className?: string;
}

export function AvatarScene({ className }: AvatarSceneProps) {
  const { stats, isLoading } = useAvatar();

  if (isLoading || !stats) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-muted-foreground">Loading avatar...</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        <PerspectiveCamera makeDefault position={[0, 1, 5]} fov={45} />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-5, 3, -5]} intensity={0.3} />

        {/* Environment for reflections */}
        <Environment preset="city" />

        {/* Avatar */}
        <Suspense fallback={<LoadingFallback />}>
          <AvatarModel
            stats={{
              health: stats.health,
              work: stats.work,
              social: stats.social,
              learning: stats.learning,
              finance: stats.finance,
            }}
          />
        </Suspense>

        {/* Ground shadow */}
        <ContactShadows
          position={[0, -1.5, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
        />

        {/* Controls */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={10}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
