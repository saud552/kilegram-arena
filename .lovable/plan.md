

# Phase 2.5: 3D Arena Upgrade with React Three Fiber

## Overview
Transform the current 2D Canvas-based `GameArena` into a professional 3D top-down battlefield using React Three Fiber, while keeping the existing weapon system, VFX logic, and networking intact.

## Architecture

The current monolithic `GameArena.tsx` (735 lines of 2D canvas code) will be restructured into a modular 3D system:

```text
src/
  components/
    GameArena.tsx          -- Orchestrator: R3F Canvas + HUD overlay (replaces current)
    arena/
      Scene3D.tsx          -- Three.js scene: camera, lights, post-processing
      Terrain.tsx          -- Ground plane with grid texture + zone circle
      Buildings.tsx         -- Procedural buildings (boxes with neon edges)
      PlayerModel3D.tsx    -- 3D player representation (capsule + weapon barrel)
      RemotePlayer3D.tsx   -- Remote player with interpolation
      Loot3D.tsx           -- Floating loot items with glow
      Bullets3D.tsx        -- Bullet trails as instanced meshes
      VFX3D.tsx            -- Muzzle flash + hit particles via drei
      GameHUD.tsx          -- Extracted HTML overlay (health, ammo, weapon selector)
      GameControls.tsx     -- Touch joystick + shoot controls (extracted)
  hooks/
    useGameLoop.ts         -- Core game tick: movement, shooting, collisions, zone
    useBroadcast.ts        -- Supabase realtime channel logic (extracted)
```

## Dependencies to Install
- `three@^0.160.0`
- `@react-three/fiber@^8.18.0` (React 18 compatible)
- `@react-three/drei@^9.122.0` (helpers: OrbitControls, Instances, etc.)
- `@react-three/postprocessing@^2.16.0` (Bloom, vignette)

## Detailed Implementation

### 1. Scene3D.tsx -- The 3D World Container
- **Camera**: Orthographic top-down camera positioned at `[0, 50, 0]` looking down, following the player
- **Lighting**:
  - Ambient light (low intensity, blue-tinted for cyberpunk feel)
  - Directional light with shadow casting for building shadows
  - Point lights on buildings (neon cyan/red accents)
- **Post-processing**: Bloom effect (threshold 0.8, intensity 0.6) for neon glow on bullets, loot, and player effects
- **Fog**: Subtle distance fog matching the dark background

### 2. Terrain.tsx -- The Battlefield Ground
- Large plane geometry (2000x2000 units matching current MAP_SIZE)
- Custom grid shader or repeating grid texture (cyan lines on dark surface)
- Zone circle rendered as a transparent cylinder or ring mesh that shrinks over time
- Danger zone visualized with a red-tinted plane outside the safe ring

### 3. Buildings.tsx -- Procedural Environment
- 15-25 procedurally placed box geometries acting as buildings
- Each building gets:
  - Dark material base with neon edge highlights (using `<Edges>` from drei)
  - Random height variation (2-6 units tall)
  - Collision bounds stored in an array for bullet/player collision checks
- Buildings placed avoiding the map center (spawn area)

### 4. PlayerModel3D.tsx -- Local Player
- Capsule geometry (body) with team-colored material
- Cylinder for weapon barrel extending in aim direction
- Skin level visual effects preserved:
  - Level 2+: emissive glow on body material
  - Level 4+: rotating ring mesh around player
  - Level 5: particle system (drei `<Sparkles>`)
- Position/rotation driven by `useGameLoop` hook

### 5. RemotePlayer3D.tsx -- Networked Players
- Same visual structure as local player
- Position interpolated (lerp) from broadcast data
- Health bar as a small plane above the player head
- Username rendered with drei `<Text>` or `<Html>`

### 6. Loot3D.tsx -- Floating Loot Items
- Instanced meshes for performance (up to 30 items)
- Each loot item: small box or sphere with emissive material
  - Gold glow for weapons, green for medkits, blue for armor, white for ammo
- Floating animation (sine-wave Y offset) and slow rotation
- Picked-up items removed from the instance buffer

### 7. Bullets3D.tsx -- Projectile System
- Instanced cylinder meshes for active bullets
- Yellow/orange emissive material with Bloom making them pop
- Trail effect via short line segments or `<Trail>` from drei
- Updated each frame from `bullets.current` array

### 8. VFX3D.tsx -- Visual Effects
- Muzzle flash: short-lived point light + sprite at barrel tip
- Hit markers: brief particle burst at impact point
- Kill indicator: `<Html>` overlay showing "KILL" text briefly

### 9. GameHUD.tsx -- Extracted UI Overlay
- All current HTML HUD elements (health bar, ammo display, weapon selector, reload button, kills counter) extracted from GameArena into a standalone React component
- Rendered as an HTML overlay on top of the R3F Canvas (not inside the 3D scene)
- No logic changes, just structural separation

### 10. GameControls.tsx -- Touch Input
- Left-side touch joystick (same logic as current)
- Right-side tap-to-shoot
- Rendered as transparent HTML overlay
- Outputs movement vector and shooting state to the game loop hook

### 11. useGameLoop.ts -- Core Logic Hook
- Extracts all game tick logic from the current `useEffect` game loop:
  - Player movement from joystick input
  - Weapon system firing (`weaponSystem.tryFire`)
  - Bullet updates and collision detection
  - Loot pickup detection
  - Zone damage calculation
  - Remote player timeout cleanup
- Returns game state consumed by 3D components
- Runs via `useFrame` from R3F (synced to render loop)

### 12. useBroadcast.ts -- Network Hook
- Extracts the Supabase realtime channel setup
- Handles player_update, player_hit, player_died, game_started events
- Returns remote players map and broadcast function

## Refactored GameArena.tsx Structure

```text
GameArena.tsx
  |-- GameControls (HTML overlay - touch input)
  |-- GameHUD (HTML overlay - health, ammo, weapon selector)
  |-- R3F Canvas
       |-- Scene3D
            |-- Camera (orthographic, top-down)
            |-- Lights (ambient + directional + point)
            |-- PostProcessing (Bloom)
            |-- Terrain (ground + grid + zone)
            |-- Buildings (procedural)
            |-- PlayerModel3D (local)
            |-- RemotePlayer3D[] (networked)
            |-- Loot3D (instanced)
            |-- Bullets3D (instanced)
            |-- VFX3D (particles)
```

## What Stays the Same
- `src/lib/weapons.ts` -- weapon configs unchanged
- `src/lib/WeaponSystem.ts` -- firing/reload logic unchanged
- `src/lib/soundManager.ts` -- audio system unchanged
- `src/context/AuthContext.tsx` -- auth unchanged
- `src/context/SquadContext.tsx` -- squad unchanged
- All networking/broadcast logic (just extracted into a hook)
- All HUD functionality (just extracted into a component)

## Performance Considerations for Telegram Mini App
- Orthographic camera (cheaper than perspective)
- Instanced meshes for bullets and loot (single draw call each)
- No complex 3D models -- all primitives (boxes, capsules, cylinders)
- Bloom post-processing with conservative settings
- Building count capped at 25
- Shadow map limited to 1024x1024
- `frameloop="demand"` option available if FPS drops on low-end devices

## Implementation Order
1. Install dependencies (three, R3F, drei, postprocessing)
2. Create `useGameLoop.ts` and `useBroadcast.ts` hooks (extract existing logic)
3. Create `GameControls.tsx` and `GameHUD.tsx` (extract existing UI)
4. Build 3D components: Terrain, Buildings, PlayerModel3D, Loot3D, Bullets3D, VFX3D
5. Create `Scene3D.tsx` composing all 3D components
6. Rewrite `GameArena.tsx` as the orchestrator
7. Test and optimize

