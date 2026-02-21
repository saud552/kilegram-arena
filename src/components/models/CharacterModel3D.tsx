// ============================================
// 3D Character Models — GLB with safe material replacement
// ============================================

import React, { useRef, Suspense, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharacterDef } from '@/lib/gameRegistry';

interface CharacterModelProps {
  character: CharacterDef;
  rotate?: boolean;
  scale?: number;
  skinLevel?: number;
}

const CHARACTER_GLB_MAP: Record<string, string> = {
  ghost_riley: '/Models/Characters/snake_eyes__fortnite_item_shop_skin.glb',
  nova_prime: '/Models/Characters/fortnite_oblivion_skin.glb',
  viper_snake: '/Models/Characters/torin__fortnite_chapter_2_season_8_bp_skin.glb',
  shadow_exe: '/Models/Characters/the_omega_tier_100_skin_fortnite_3d_model.glb',
  midas_gold: '/Models/Characters/midas__fortnite_100_tier_s12_bp_skin.glb',
  marigold: '/Models/Characters/marigold_fortnite_skin__female_midas.glb',
  glow_phantom: '/Models/Characters/glow__fortnite_outfit.glb',
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

const GLBCharacter: React.FC<{ characterId: string; onError?: () => void }> = ({ characterId, onError }) => {
  const path = CHARACTER_GLB_MAP[characterId];
  
  let gltf: any;
  try {
    gltf = useGLTF(path);
  } catch (e) {
    console.error(`[CharacterModel3D] useGLTF failed for ${characterId}:`, e);
    onError?.();
    return null;
  }

  const cloned = React.useMemo(() => {
    try {
      // Use SkeletonUtils.clone for skinned meshes (character models)
      const c = SkeletonUtils.clone(gltf.scene);
      sanitizeMaterials(c);
      return c;
    } catch (e) {
      console.error(`[CharacterModel3D] Clone/sanitize failed for ${characterId}:`, e);
      return null;
    }
  }, [gltf.scene, characterId]);

  if (!cloned) return null;

  return (
    <Center>
      <primitive object={cloned} />
    </Center>
  );
};

const FallbackModel: React.FC<{ colors: CharacterDef['colors'] }> = ({ colors }) => (
  <group>
    <mesh position={[0, 0.5, 0]}>
      <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
      <meshStandardMaterial color={colors.primary} roughness={0.5} metalness={0.3} />
    </mesh>
    <mesh position={[0, 1.1, 0]}>
      <sphereGeometry args={[0.2, 12, 12]} />
      <meshStandardMaterial color={colors.secondary} roughness={0.4} metalness={0.5} />
    </mesh>
  </group>
);

class GLBErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error: any }
> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) { 
    console.error('[GLBErrorBoundary] Caught render error:', error?.message || error);
    return { hasError: true, error }; 
  }
  componentDidCatch(error: any, info: any) {
    console.error('[GLBErrorBoundary] Error details:', error, info?.componentStack);
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

const CharacterModel3D: React.FC<CharacterModelProps> = ({ character, rotate = true, scale = 1 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [loadError, setLoadError] = useState(false);
  
  useFrame((_, delta) => {
    if (rotate && groupRef.current) groupRef.current.rotation.y += delta * 0.4;
  });

  const hasGLB = character.id in CHARACTER_GLB_MAP;
  const fallback = <FallbackModel colors={character.colors} />;

  if (loadError || !hasGLB) {
    return <group ref={groupRef} scale={scale}>{fallback}</group>;
  }

  return (
    <group ref={groupRef} scale={scale}>
      <GLBErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <GLBCharacter characterId={character.id} onError={() => setLoadError(true)} />
        </Suspense>
      </GLBErrorBoundary>
    </group>
  );
};

export default CharacterModel3D;

Object.values(CHARACTER_GLB_MAP).forEach(path => {
  try { useGLTF.preload(path); } catch {}
});
