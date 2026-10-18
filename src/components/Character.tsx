import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import ReminderBubble from "./ReminderBubble";

type CharacterName = "female" | "male" | "penguin";
type Phase =
  | "walkingIn"
  | "turningToCamera"
  | "talking"
  | "turningToRight"
  | "walkingOut"
  | "idle";

const START_X = -1.05;
const CENTER_X = 0;
const RIGHT_X = 0.82;
const WALK_SPEED = 1.3;
const TURN_DURATION = 0.7;
const TALK_DURATION = 5;
const FADE = 0.3;
const TARGET_HEIGHT = 1.35;
const GROUND_Y = -0.9;
const FACE_CAMERA = 0;
const FACE_RIGHT = Math.PI / 2;

type CharacterProps = {
  character?: CharacterName;
  stringMessage?: string;
  bubbleTitle?: string;
  bubbleMeta?: string;
  showBubble?: boolean;
  messageKey?: string;
  scale?: number;
  bubbleScale?: number;
  bubbleFontSize?: number;
  bubbleBackground?: string;
  bubbleTextColor?: string;
  bubbleAccentColor?: string;
  bubbleMaxWidth?: number;
  onFinish?: () => void;
};

function stripRootMotion(clip: THREE.AnimationClip) {
  clip.tracks.forEach((track) => {
    if (track.name.endsWith(".position") && /hips/i.test(track.name)) {
      const values = track.values;
      const x0 = values[0];
      const z0 = values[2];
      for (let i = 0; i < values.length; i += 3) {
        values[i] = x0;
        values[i + 2] = z0;
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

  const nextScale = targetHeight / size.y;
  model.scale.setScalar(nextScale);
  model.updateMatrixWorld(true);

  const grounded = new THREE.Box3().setFromObject(model);
  model.position.y -= grounded.min.y;
}

function fitClipToModel(clip: THREE.AnimationClip, model: THREE.Object3D) {
  const strip = (name: string) => name.replace(/^mixamorig\d*:?/, "");
  const byBase = new Map<string, string>();
  model.traverse((object) => {
    if ((object as THREE.Bone).isBone)
      byBase.set(strip(object.name), object.name);
  });

  clip.tracks = clip.tracks.filter((track) => {
    const index = track.name.indexOf(".");
    if (index === -1) return false;
    const bone = track.name.slice(0, index);
    const prop = track.name.slice(index);
    const target = byBase.get(strip(bone));
    if (!target) return false;
    track.name = `${target}${prop}`;
    return true;
  });

  return clip;
}

function Character({
  character = "female",
  stringMessage = "Hey, Vaibhav!",
  bubbleTitle = "Hey there!",
  bubbleMeta = "Developer tips",
  showBubble = true,
  messageKey = "default",
  scale = 1,
  bubbleScale = 1,
  bubbleFontSize = 14,
  bubbleBackground = "#fff1d1",
  bubbleTextColor = "#242424",
  bubbleAccentColor = "#c77713",
  bubbleMaxWidth = 220,
  onFinish,
}: CharacterProps) {
  const group = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const scaleRef = useRef(scale);
  const baseModelScaleRef = useRef(1);
  const baseModelYRef = useRef(0);
  const actions = useRef<Record<string, THREE.AnimationAction>>({});

  const phaseRef = useRef<Phase>("walkingIn");
  const turnFrom = useRef(FACE_RIGHT);
  const turnTo = useRef(FACE_CAMERA);
  const turnElapsed = useRef(0);
  const talkElapsed = useRef(0);

  const [ready, setReady] = useState(false);
  const [showReminder, setShowReminder] = useState(showBubble);

  const getModelPath = (file: string) => `${import.meta.env.BASE_URL}${file}`;

  useEffect(() => {
    scaleRef.current = scale;
    const model = modelRef.current;
    if (model) {
      model.scale.setScalar(baseModelScaleRef.current * scale);
      model.position.y = baseModelYRef.current * scale;
      model.updateMatrixWorld(true);
    }
  }, [scale]);

  const isReminderVisible = showBubble && showReminder;

  useEffect(() => {
    if (!showBubble || !ready) return;
    const root = group.current;
    const model = modelRef.current;
    if (!root || !model) return;

    root.position.set(START_X, GROUND_Y, 0);
    model.rotation.y = FACE_RIGHT;
    phaseRef.current = "walkingIn";
    turnFrom.current = FACE_RIGHT;
    turnTo.current = FACE_CAMERA;
    turnElapsed.current = 0;
    talkElapsed.current = 0;
    setShowReminder(false);

    if (actions.current.walking) {
      actions.current.walking.reset().setEffectiveWeight(1).play();
    }
    if (actions.current.talking) {
      actions.current.talking.stop();
    }
  }, [messageKey, ready, showBubble]);

  useEffect(() => {
    const loader = new FBXLoader();
    let characterModel: THREE.Group | null = null;
    let cancelled = false;

    async function load() {
      try {
        const selectedModelPath = `models/${character}.fbx`;
        const animationBundle = [
          loader.loadAsync(getModelPath(selectedModelPath)),
          loader.loadAsync(getModelPath("models/walking.fbx")),
          loader.loadAsync(getModelPath("models/talking.fbx")),
        ];

        const [model, walking, talking] = await Promise.all(animationBundle);
        if (cancelled) return;

        characterModel = model;
        phaseRef.current = "walkingIn";
        turnFrom.current = FACE_RIGHT;
        turnTo.current = FACE_CAMERA;
        turnElapsed.current = 0;
        talkElapsed.current = 0;
        if (group.current) {
          group.current.position.set(START_X, GROUND_Y, 0);
          group.current.visible = true;
        }
        setReady(false);
        normalizeModel(model);
        // Scale the model itself, not the movement root, so scale changes never
        // multiply the walking distance and push the character outside the viewport.
        baseModelScaleRef.current = model.scale.x;
        baseModelYRef.current = model.position.y;
        model.scale.setScalar(baseModelScaleRef.current * scaleRef.current);
        model.position.y = baseModelYRef.current * scaleRef.current;
        model.rotation.y = FACE_RIGHT;

        group.current?.add(model);
        model.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;

          const materialFactory = (old: THREE.Material) => {
            const src = old as THREE.MeshStandardMaterial;
            if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;

            const nextMaterial = new THREE.MeshBasicMaterial({
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
            return nextMaterial;
          };

          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(materialFactory)
            : materialFactory(mesh.material);
        });

        modelRef.current = model;
        mixer.current = new THREE.AnimationMixer(model);

        const walkClip =
          (walking.animations[0] &&
            fitClipToModel(walking.animations[0], model)) ??
          null;
        const talkClip =
          (talking.animations[0] &&
            fitClipToModel(talking.animations[0], model)) ??
          null;

        if (walkClip) {
          stripRootMotion(walkClip);
          actions.current.walking = mixer.current.clipAction(walkClip);
          actions.current.walking.setLoop(THREE.LoopRepeat, Infinity);
        }

        if (talkClip) {
          actions.current.talking = mixer.current.clipAction(talkClip);
          actions.current.talking.setLoop(THREE.LoopRepeat, Infinity);
        }

        if (actions.current.walking) actions.current.walking.play();
        setReady(true);
      } catch (error) {
        console.error("Failed to load character assets:", error);
      }
    }

    void load();

    const currentGroup = group.current;
    return () => {
      cancelled = true;
      if (characterModel && currentGroup) {
        currentGroup.remove(characterModel);
      }
      mixer.current?.stopAllAction();
      mixer.current = null;
      modelRef.current = null;
      actions.current = {};
    };
  }, [character]);

  function startTurn(to: number, next: Phase) {
    turnFrom.current = modelRef.current?.rotation.y ?? 0;
    turnTo.current = to;
    turnElapsed.current = 0;
    phaseRef.current = next;
  }

  useFrame((_, rawDelta) => {
    if (showReminder !== showBubble) {
      setShowReminder(showBubble);
    }

    const delta = Math.min(rawDelta, 0.05);
    mixer.current?.update(delta);

    const root = group.current;
    const model = modelRef.current;
    if (!root || !model || !ready) return;

    const { walking, talking } = actions.current;

    switch (phaseRef.current) {
      case "walkingIn": {
        root.visible = true;
        root.position.x = Math.min(
          root.position.x + WALK_SPEED * delta,
          CENTER_X,
        );
        if (root.position.x >= CENTER_X) {
          if (walking && talking) crossFade(walking, talking);
          startTurn(FACE_CAMERA, "turningToCamera");
        }
        break;
      }
      case "turningToCamera": {
        turnElapsed.current += delta;
        const progress = Math.min(turnElapsed.current / TURN_DURATION, 1);
        model.rotation.y = THREE.MathUtils.lerp(
          turnFrom.current,
          turnTo.current,
          THREE.MathUtils.smootherstep(progress, 0, 1),
        );
        if (progress >= 1) {
          talkElapsed.current = 0;
          phaseRef.current = "talking";
          setShowReminder(true);
        }
        break;
      }
      case "talking": {
        talkElapsed.current += delta;
        if (talkElapsed.current >= TALK_DURATION) {
          setShowReminder(false);
          if (talking && walking) crossFade(talking, walking);
          startTurn(FACE_RIGHT, "turningToRight");
        }
        break;
      }
      case "turningToRight": {
        turnElapsed.current += delta;
        const progress = Math.min(turnElapsed.current / TURN_DURATION, 1);
        const eased = THREE.MathUtils.smootherstep(progress, 0, 1);
        model.rotation.y = THREE.MathUtils.lerp(
          turnFrom.current,
          turnTo.current,
          eased,
        );
        root.position.x += WALK_SPEED * eased * delta;
        if (progress >= 1) phaseRef.current = "walkingOut";
        break;
      }
      case "walkingOut": {
        root.position.x += WALK_SPEED * delta;
        if (root.position.x >= RIGHT_X) {
          root.position.x = RIGHT_X;
          root.visible = true;
          model.rotation.y = FACE_CAMERA;
          phaseRef.current = "idle";
          // No dedicated idle FBX is bundled; loop the gesture clip as a
          // subtle standing animation while keeping the character screen-facing.
          if (walking && talking) crossFade(walking, talking, 0.25);
          else if (talking) talking.reset().setEffectiveWeight(1).play();
          onFinish?.();
        }
        break;
      }
      default:
        break;
    }
  });

  return (
    <group ref={group} position={[START_X, GROUND_Y, 0]}>
      {ready && isReminderVisible && (
        <Html
          position={[0, TARGET_HEIGHT + 0.7, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: "none", position: "relative" }}
        >
          <div
            style={{
              transform: `scale(${Math.max(0.65, Math.min(bubbleScale, 1.25))})`,
              transformOrigin: "bottom center",
            }}
          >
            <ReminderBubble
              title={bubbleTitle}
              text={stringMessage}
              meta={bubbleMeta}
              fontSize={bubbleFontSize}
              background={bubbleBackground}
              textColor={bubbleTextColor}
              accentColor={bubbleAccentColor}
              maxWidth={bubbleMaxWidth}
            />
          </div>
        </Html>
      )}
    </group>
  );
}

export default Character;
