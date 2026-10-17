import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import ReminderBubble from "./ReminderBubble";

type Phase =
  | "walkingIn"
  | "turningToCamera"
  | "talking"
  | "turningToRight"
  | "walkingOut"
  | "done";

// ---- Tweakables -------------------------------------------------------
const START_X = -4;
const CENTER_X = 0;
const EXIT_X = 6;
const WALK_SPEED = 1.3; // world units / sec (tune to match the walk clip, avoids foot sliding)
const TURN_DURATION = 0.7; // sec
const TALK_DURATION = 3; // sec the reminder stays visible
const FADE = 0.3; // sec animation crossfade
const TARGET_HEIGHT = 1.2; // was 2, smaller character
const GROUND_Y = -2.2; // lower = closer to bottom of screen

// Mixamo characters face +Z by default.
// Camera on +Z looking at origin => 0 faces the camera, +PI/2 faces screen-right.
const FACE_CAMERA = 0;
const FACE_RIGHT = Math.PI / 2;
// -----------------------------------------------------------------------

// Removes baked-in forward drift from the hips so we control movement in code.
function stripRootMotion(clip: THREE.AnimationClip) {
  clip.tracks.forEach((track) => {
    if (track.name.endsWith(".position") && /hips/i.test(track.name)) {
      const v = track.values;
      const x0 = v[0];
      const z0 = v[2];
      for (let i = 0; i < v.length; i += 3) {
        v[i] = x0;
        v[i + 2] = z0;
      }
    }
  });
  return clip;
}

function crossFade(
  from: THREE.AnimationAction | undefined,
  to: THREE.AnimationAction | undefined,
  duration = FADE,
) {
  if (!from || !to) return;
  to.reset().setEffectiveWeight(1).play();
  from.crossFadeTo(to, duration, false);
}

function normalizeModel(model: THREE.Object3D, targetHeight = TARGET_HEIGHT) {
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const s = targetHeight / size.y;
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);

  // Put feet on the ground (y = 0 of the group)
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.y -= box2.min.y;
}

function Character({ onFinish }: { onFinish?: () => void }) {
  const group = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<Record<string, THREE.AnimationAction>>({});

  const phaseRef = useRef<Phase>("walkingIn");
  const turnFrom = useRef(FACE_RIGHT);
  const turnTo = useRef(FACE_CAMERA);
  const turnElapsed = useRef(0);
  const talkElapsed = useRef(0);

  const [ready, setReady] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  const getModelPath = (file: string) => `${import.meta.env.BASE_URL}${file}`;

  function fitClipToModel(clip: THREE.AnimationClip, model: THREE.Object3D) {
    const strip = (n: string) => n.replace(/^mixamorig\d*:?/, "");
    const byBase = new Map<string, string>();
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) byBase.set(strip(o.name), o.name);
    });

    const before = clip.tracks.length;
    clip.tracks = clip.tracks.filter((t) => {
      const i = t.name.indexOf(".");
      const bone = t.name.slice(0, i);
      const prop = t.name.slice(i);
      const target = byBase.get(strip(bone));
      if (!target) return false;
      t.name = target + prop;
      return true;
    });
    console.log(`${clip.name}: kept ${clip.tracks.length}/${before} tracks`);
    return clip;
  }

  useEffect(() => {
    const loader = new FBXLoader();
    let character: THREE.Group | null = null;
    let cancelled = false;

    async function load() {
      try {
        const [model, walking, talking] = await Promise.all([
          loader.loadAsync(getModelPath("models/female.fbx")),
          loader.loadAsync(getModelPath("models/walking.fbx")),
          loader.loadAsync(getModelPath("models/talking.fbx")),
        ]);

        if (cancelled) return;

        character = model;
        // model.scale.setScalar(0.01);
        normalizeModel(model);
        model.rotation.y = FACE_RIGHT; // start facing right

        group.current?.add(model);
        model.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;

          const convert = (old: THREE.Material) => {
            const src = old as THREE.MeshStandardMaterial;
            if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;

            const basic = new THREE.MeshBasicMaterial({
              map: src.map ?? null,
              color: src.map
                ? 0xffffff
                : (src.color ?? new THREE.Color(0xffffff)),
              transparent: src.transparent,
              opacity: src.opacity,
              alphaTest: src.alphaTest,
              side: src.side,
            });
            old.dispose();
            return basic;
          };

          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(convert)
            : convert(mesh.material);
        });
        modelRef.current = model;

        mixer.current = new THREE.AnimationMixer(model);

        const walkClip = fitClipToModel(walking.animations[0], model);
        const talkClip = fitClipToModel(talking.animations[0], model);

        const bones: string[] = [];
        model.traverse((o) => {
          if ((o as THREE.Bone).isBone) bones.push(o.name);
        });
        console.log("PENGUIN bones:", bones);
        model.traverse((o) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh)
            console.log("skinned:", o.name);
        });

        if (!walkClip || !talkClip) {
          throw new Error("Walking or talking animation clip is missing.");
        }

        stripRootMotion(walkClip);

        // Walk loops so the character keeps walking naturally.
        actions.current.walking = mixer.current.clipAction(walkClip);
        actions.current.walking.setLoop(THREE.LoopRepeat, Infinity);

        actions.current.talking = mixer.current.clipAction(talkClip);
        actions.current.talking.setLoop(THREE.LoopRepeat, Infinity);

        actions.current.walking.play();
        setReady(true);
      } catch (error) {
        console.error("Failed to load character assets:", error);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (character) group.current?.remove(character);
      mixer.current?.stopAllAction();
      mixer.current = null;
      modelRef.current = null;
      actions.current = {};
    };
  }, []);

  function startTurn(to: number, next: Phase) {
    turnFrom.current = modelRef.current?.rotation.y ?? 0;
    turnTo.current = to;
    turnElapsed.current = 0;
    phaseRef.current = next;
  }

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05); // avoid jumps on tab switch
    mixer.current?.update(delta);

    const root = group.current;
    const model = modelRef.current;
    if (!root || !model || !ready) return;

    const { walking, talking } = actions.current;

    switch (phaseRef.current) {
      // 1. Walk left -> center, facing right
      case "walkingIn": {
        root.position.x = Math.min(
          root.position.x + WALK_SPEED * delta,
          CENTER_X,
        );
        if (root.position.x >= CENTER_X) {
          crossFade(walking, talking);
          startTurn(FACE_CAMERA, "turningToCamera");
        }
        break;
      }

      // 2. Turn toward the screen
      case "turningToCamera": {
        turnElapsed.current += delta;
        const p = Math.min(turnElapsed.current / TURN_DURATION, 1);
        model.rotation.y = THREE.MathUtils.lerp(
          turnFrom.current,
          turnTo.current,
          THREE.MathUtils.smootherstep(p, 0, 1),
        );
        if (p >= 1) {
          talkElapsed.current = 0;
          phaseRef.current = "talking";
          setShowReminder(true);
        }
        break;
      }

      // 3. Show reminder for 3 sec
      case "talking": {
        talkElapsed.current += delta;
        if (talkElapsed.current >= TALK_DURATION) {
          setShowReminder(false);
          crossFade(talking, walking);
          startTurn(FACE_RIGHT, "turningToRight");
        }
        break;
      }

      // 4. Turn back to the right while easing into the walk
      case "turningToRight": {
        turnElapsed.current += delta;
        const p = Math.min(turnElapsed.current / TURN_DURATION, 1);
        const eased = THREE.MathUtils.smootherstep(p, 0, 1);
        model.rotation.y = THREE.MathUtils.lerp(
          turnFrom.current,
          turnTo.current,
          eased,
        );
        // Ramp speed up with the turn so there is no sudden start
        root.position.x += WALK_SPEED * eased * delta;
        if (p >= 1) phaseRef.current = "walkingOut";
        break;
      }

      // 5. Walk off to the right
      case "walkingOut": {
        root.position.x += WALK_SPEED * delta;
        if (root.position.x >= EXIT_X) {
          phaseRef.current = "done";
          root.visible = false;
          onFinish?.();
        }
        break;
      }
    }
  });

  return (
    <group ref={group} position={[START_X, GROUND_Y, 0]}>
      {ready && showReminder && (
        <Html
          position={[0, TARGET_HEIGHT + 1, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: "none", position: "relative" }}
        >
          <ReminderBubble />
        </Html>
      )}
    </group>
  );
}

export default Character;
