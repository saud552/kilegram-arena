// ============================================
// 3D Weapon Models — GLB with safe material replacement
// ============================================

import React, { useRef, Suspense, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

interface WeaponModelProps {
  weaponId: string;
  rotate?: boolean;
  scale?: number;
}

const WEAPON_GLB_MAP: Record<string, string> = {
  k416: '/Models/weapons/rifle__m4a1-s_weapon_model_cs2.glb',
  ak_death: '/Models/weapons/ak-47disassembly_of_weapons.glb',
  awm_x: '/Models/weapons/rifle__awp_weapon_model_cs2.glb',
  vector_neon: '/Models/weapons/animated_pp-19-01.glb',
  s12_breacher: '/Models/weapons/shotgun_mr-133_animated.glb',
  desert_eagle: '/Models/weapons/pistol__desert_eagle_weapon_model_cs2.glb',
  glock_17: '/Models/weapons/glock_17_-_fps_weapon_animations_pack_v.1.glb',
  m4a4_thunder: '/Models/weapons/rifle__m4a4_weapon_model_cs2.glb',
  sniper_elite: '/Models/weapons/sniper.glb',
  usp_shadow: '/Models/weapons/pistol__usp-s_weapon_model_cs2.glb',
  awp_black: '/Models/weapons/rifle__awp_black_version_weapon_model_cs2.glb',
  cz100: '/Models/weapons/cz100__realtime_weapon.glb',
  cheytac: '/Models/weapons/cheytac_m300_mcmillan_stock.glb',
  t77: '/Models/weapons/t77_handgun.glb',
  colt_m1911: '/Models/weapons/colt_pistol_m1911a1_game_asset.glb',
};

/** Replace all materials in a scene with safe MeshStandardMaterial */
function sanitizeMaterials(obj: THREE.Object3D) {
  obj.traverse((child: any) => {
    if (!child.isMesh) return;
    
    const replaceMat = (mat: any): THREE.MeshStandardMaterial => {
      try {
        const safeMat = new THREE.MeshStandardMaterial({
          color: (mat && mat.color) ? mat.color.clone() : new THREE.Color(0x888888),
          map: (mat && mat.map) || null,
          normalMap: (mat && mat.normalMap) || null,
          roughness: (mat && mat.roughness != null) ? mat.roughness : 0.5,
          metalness: (mat && mat.metalness != null) ? mat.metalness : 0.3,
          side: THREE.DoubleSide,
          transparent: (mat && mat.transparent) || false,
          opacity: (mat && mat.opacity != null) ? mat.opacity : 1,
        });
        return safeMat;
      } catch {
        return new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.5,
          metalness: 0.3,
          side: THREE.DoubleSide,
        });
      }
    };

    try {
      if (Array.isArray(child.material)) {
        child.material = child.material.map(replaceMat);
      } else if (child.material) {
        child.material = replaceMat(child.material);
      } else {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          side: THREE.DoubleSide,
        });
      }
    } catch {
      child.material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        side: THREE.DoubleSide,
      });
    }
  });
}

const GLBWeapon: React.FC<{ weaponId: string; onError?: () => void }> = ({ weaponId, onError }) => {
  const path = WEAPON_GLB_MAP[weaponId];
  
  let gltf: any;
  try {
    gltf = useGLTF(path);
  } catch (e) {
    console.error(`[WeaponModel3D] useGLTF failed for ${weaponId}:`, e);
    onError?.();
    return null;
  }

  const cloned = React.useMemo(() => {
    try {
      const c = gltf.scene.clone(true);
      sanitizeMaterials(c);
      return c;
    } catch (e) {
      console.error(`[WeaponModel3D] Clone/sanitize failed for ${weaponId}:`, e);
      return null;
    }
  }, [gltf.scene, weaponId]);

  if (!cloned) return null;

  return (
    <Center>
      <primitive object={cloned} />
    </Center>
  );
};

const FallbackWeapon: React.FC<{ scale: number }> = ({ scale }) => (
  <group scale={scale}>
    {/* Rifle body */}
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[1.2, 0.15, 0.08]} />
      <meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.8} />
    </mesh>
    {/* Stock */}
    <mesh position={[-0.5, -0.05, 0]}>
      <boxGeometry args={[0.3, 0.2, 0.06]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.6} />
    </mesh>
    {/* Barrel */}
    <mesh position={[0.7, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
      <meshStandardMaterial color="#333" roughness={0.2} metalness={0.9} />
    </mesh>
    {/* Magazine */}
    <mesh position={[0.1, -0.15, 0]}>
      <boxGeometry args={[0.08, 0.15, 0.05]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.7} />
    </mesh>
  </group>
);

class GLBErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError(error: any) { 
    console.error('[WeaponGLBErrorBoundary] Caught render error:', error?.message || error);
    return { hasError: true }; 
  }
  componentDidCatch(error: any, info: any) {
    console.error('[WeaponGLBErrorBoundary] Error details:', error, info?.componentStack);
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

const WeaponModel3D: React.FC<WeaponModelProps> = ({ weaponId, rotate = true, scale = 1 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [loadError, setLoadError] = useState(false);
  
  useFrame((_, delta) => {
    if (rotate && groupRef.current) groupRef.current.rotation.y += delta * 0.5;
  });

  const hasGLB = weaponId in WEAPON_GLB_MAP;
  const fallback = <FallbackWeapon scale={scale} />;

  if (loadError || !hasGLB) {
    return <group ref={groupRef} scale={scale}>{fallback}</group>;
  }

  return (
    <group ref={groupRef} scale={scale}>
      <GLBErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <GLBWeapon weaponId={weaponId} onError={() => setLoadError(true)} />
        </Suspense>
      </GLBErrorBoundary>
    </group>
  );
};

export default WeaponModel3D;

Object.values(WEAPON_GLB_MAP).forEach(path => {
  try { useGLTF.preload(path); } catch {}
});
