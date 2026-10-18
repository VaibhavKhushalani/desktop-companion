import "./App.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Character from "./components/Character";
import {
  DEFAULT_COMPANION_MESSAGE,
  DEFAULT_COMPANION_UI,
  DEFAULT_REMINDER_SETTINGS,
} from "./lib/companionDefaults";
import {
  getJudgeFeedback,
  judgeCommitMessage,
  type JudgeStyle,
} from "./lib/gitJudge";

type CharacterName = "female" | "male" | "penguin";
type ScreenPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center";
type ThemeMode = "dark" | "light";
type CompanionMessageSource =
  | "greeting"
  | "reminder"
  | "git-judge"
  | "custom"
  | "idle";

type CompanionMessage = {
  id: string;
  title: string;
  text: string;
  meta: string;
  source: CompanionMessageSource;
  priority: number;
  createdAt: string;
  expiresAt?: string | null;
};

type AppState = {
  selectedCharacter: CharacterName;
  theme: ThemeMode;
  position: ScreenPosition;
  showBubble: boolean;
  bubbleText: string;
  bubbleTitle: string;
  bubbleMeta: string;
  latestMessage: CompanionMessage | null;
  repoCount: number;
  scale: number;
  bubbleScale: number;
  bubbleFontSize: number;
  bubbleBackground: string;
  bubbleTextColor: string;
  bubbleAccentColor: string;
  bubbleMaxWidth: number;
  animationEnabled: boolean;
  autoJudge: boolean;
  judgeStyle: JudgeStyle;
  repoPath: string;
  repositories: Array<{
    id: string;
    name: string;
    path: string;
    enabled: boolean;
    branch: string;
    latestHash: string;
    lastJudged: string;
  }>;
  judgments: Array<{
    id: string;
    repository: string;
    message: string;
    score: number;
    verdict: string;
    feedback: string;
    date: string;
  }>;
  reminders: Array<{
    id: string;
    title: string;
    note: string;
    at: string;
    done: boolean;
  }>;
  activeSection: string;
};

type DashboardSection =
  | "Overview"
  | "Companion"
  | "Git Judge"
  | "Reminders"
  | "Bubble UI";

const STORAGE_KEY = "desktop_companion_state_v1";
const defaultGreeting: CompanionMessage = {
  ...DEFAULT_COMPANION_MESSAGE,
  createdAt: new Date().toISOString(),
};

const defaultState: AppState = {
  selectedCharacter: DEFAULT_COMPANION_UI.selectedCharacter,
  theme: DEFAULT_COMPANION_UI.theme,
  position: DEFAULT_COMPANION_UI.position,
  showBubble: DEFAULT_COMPANION_UI.showBubble,
  bubbleText: defaultGreeting.text,
  bubbleTitle: defaultGreeting.title,
  bubbleMeta: defaultGreeting.meta,
  latestMessage: defaultGreeting,
  repoCount: 0,
  scale: DEFAULT_COMPANION_UI.scale,
  bubbleScale: DEFAULT_COMPANION_UI.bubbleScale,
  bubbleFontSize: DEFAULT_COMPANION_UI.bubbleFontSize,
  bubbleBackground: DEFAULT_COMPANION_UI.bubbleBackground,
  bubbleTextColor: DEFAULT_COMPANION_UI.bubbleTextColor,
  bubbleAccentColor: DEFAULT_COMPANION_UI.bubbleAccentColor,
  bubbleMaxWidth: DEFAULT_COMPANION_UI.bubbleMaxWidth,
  animationEnabled: DEFAULT_COMPANION_UI.animationEnabled,
  autoJudge: DEFAULT_COMPANION_UI.autoJudge,
  judgeStyle: DEFAULT_COMPANION_UI.judgeStyle,
  repoPath: "",
  repositories: [],
  judgments: [],
  reminders: [],
  activeSection: "Reminders",
};

function readState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...defaultState,
      ...parsed,
      activeSection: ["Reminders", "Git Judge", "Bubble UI"].includes(
        String(parsed.activeSection),
      )
        ? (parsed.activeSection as DashboardSection)
        : "Reminders",
      latestMessage: parsed.latestMessage ?? defaultGreeting,
      scale: Math.min(
        1.25,
        Math.max(0.55, Number(parsed.scale ?? defaultState.scale)),
      ),
      bubbleScale: Math.min(
        1.25,
        Math.max(0.65, Number(parsed.bubbleScale ?? defaultState.bubbleScale)),
      ),
      bubbleFontSize: Math.min(
        18,
        Math.max(
          10,
          Number(parsed.bubbleFontSize ?? defaultState.bubbleFontSize),
        ),
      ),
      bubbleMaxWidth: Math.min(
        260,
        Math.max(
          140,
          Number(parsed.bubbleMaxWidth ?? defaultState.bubbleMaxWidth),
        ),
      ),
      bubbleBackground:
        parsed.bubbleBackground ?? defaultState.bubbleBackground,
      bubbleTextColor: parsed.bubbleTextColor ?? defaultState.bubbleTextColor,
      bubbleAccentColor:
        parsed.bubbleAccentColor ?? defaultState.bubbleAccentColor,
    };
  } catch {
    return defaultState;
  }
}

function normalizeText(value: string, fallback: string, maxLength = 180) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function getPositionPixels(position: ScreenPosition) {
  const screenWidth = window.screen?.availWidth || window.innerWidth || 1440;
  const screenHeight = window.screen?.availHeight || window.innerHeight || 900;
  const companionWidth = 460;
  const companionHeight = 500;
  const margin = 24;

  if (position === "top-left") {
    return {
      x: margin,
      y: margin,
      width: companionWidth,
      height: companionHeight,
    };
  }

  if (position === "top-right") {
    return {
      x: Math.max(margin, screenWidth - companionWidth - margin),
      y: margin,
      width: companionWidth,
      height: companionHeight,
    };
  }

  if (position === "bottom-left") {
    return {
      x: margin,
      y: Math.max(margin, screenHeight - companionHeight - margin),
      width: companionWidth,
      height: companionHeight,
    };
  }

  if (position === "bottom-center") {
    return {
      x: Math.max(margin, screenWidth / 2 - companionWidth / 2),
      y: Math.max(margin, screenHeight - companionHeight - margin),
      width: companionWidth,
      height: companionHeight,
    };
  }

  if (position === "center") {
    return {
      x: Math.max(0, screenWidth / 2 - companionWidth / 2),
      y: Math.max(0, screenHeight / 2 - companionHeight / 2),
      width: companionWidth,
      height: companionHeight,
    };
  }

  return {
    x: Math.max(margin, screenWidth - companionWidth - margin),
    y: Math.max(margin, screenHeight - companionHeight - margin),
    width: companionWidth,
    height: companionHeight,
  };
}

function getLatestEligibleMessage(state: AppState): CompanionMessage {
  const now = Date.now();
  const active = state.latestMessage;
  if (
    active &&
    active.source !== "greeting" &&
    active.expiresAt &&
    new Date(active.expiresAt).getTime() > now
  ) {
    return active;
  }

  return {
    id: "default-greeting",
    title: normalizeText(state.bubbleTitle, "Hey there!", 60),
    text: normalizeText(state.bubbleText, "Your companion is ready to help."),
    meta: normalizeText(state.bubbleMeta, "Developer status", 60),
    source: "greeting",
    priority: 25,
    createdAt: new Date().toISOString(),
  };
}

function App() {
  const [state, setState] = useState<AppState>(readState);
  const [mode] = useState<"companion" | "dashboard">(() => {
    return new URLSearchParams(window.location.search).get("mode") ===
      "dashboard"
      ? "dashboard"
      : "companion";
  });
  const isDragging = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderDateTime, setReminderDateTime] = useState(() => {
    const date = new Date(
      Date.now() + DEFAULT_REMINDER_SETTINGS.leadMinutes * 60_000,
    );
    date.setSeconds(0, 0);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  });
  const [reminderMinDateTime, setReminderMinDateTime] = useState(() => {
    const date = new Date(
      Date.now() + DEFAULT_REMINDER_SETTINGS.minLeadSeconds * 1000,
    );
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  });

  useEffect(() => {
    const tick = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      setReminderMinDateTime(
        new Date(currentTime + DEFAULT_REMINDER_SETTINGS.minLeadSeconds * 1000)
          .toISOString()
          .slice(0, 16),
      );
    };

    tick();
    const intervalId = window.setInterval(tick, 500);
    return () => window.clearInterval(intervalId);
  }, []);

  const applyCompanionMessage = useCallback(
    (
      payload: Partial<CompanionMessage> & {
        text?: string;
        title?: string;
        meta?: string;
      },
      sourceState: Pick<
        AppState,
        "bubbleTitle" | "bubbleText" | "bubbleMeta"
      > = state,
    ) => {
      const next = {
        id: payload.id ?? crypto.randomUUID(),
        title: normalizeText(
          payload.title ?? sourceState.bubbleTitle ?? "Hey there!",
          "Hey there!",
          60,
        ),
        text: normalizeText(
          payload.text ?? sourceState.bubbleText ?? "Ready when you are.",
          "Ready when you are.",
          180,
        ),
        meta: normalizeText(
          payload.meta ?? sourceState.bubbleMeta ?? "Developer status",
          "Developer status",
          60,
        ),
        source: payload.source ?? "custom",
        priority: Number.isFinite(payload.priority)
          ? Number(payload.priority)
          : 70,
        createdAt: payload.createdAt ?? new Date().toISOString(),
        expiresAt: payload.expiresAt ?? new Date(Date.now() + 5_000).toISOString(),
      };

      setState((current) => ({
        ...current,
        latestMessage: next,
        showBubble: true,
      }));

      if (window.electronAPI?.updateCompanionMessage) {
        void window.electronAPI.updateCompanionMessage({
          title: next.title,
          text: next.text,
          meta: next.meta,
          source: next.source,
          priority: next.priority,
        });
      }

      return next;
    },
    [state],
  );

  const publishCompanionMessage = useCallback(
    (
      payload: Partial<CompanionMessage> & {
        text?: string;
        title?: string;
        meta?: string;
      },
    ) => applyCompanionMessage(payload, state),
    [applyCompanionMessage, state],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      let fired: string[] = [];
      try {
        fired = JSON.parse(
          localStorage.getItem("desktop_companion_fired_reminders_v1") || "[]",
        ) as string[];
      } catch {
        fired = [];
      }

      const due = state.reminders.find(
        (item) =>
          !item.done &&
          new Date(item.at).getTime() <= now &&
          !fired.includes(item.id),
      );

      if (!due) return;

      const nextFired = [...new Set([...fired, due.id])];
      localStorage.setItem(
        "desktop_companion_fired_reminders_v1",
        JSON.stringify(nextFired),
      );

      const message = {
        title: due.title || "Reminder",
        text: due.note || "It's time for your reminder.",
        meta: new Date(due.at).toLocaleString(),
        source: "reminder" as const,
        priority: 100,
      };

      publishCompanionMessage(message);
      setState((current) => ({
        ...current,
        reminders: current.reminders.map((item) =>
          item.id === due.id ? { ...item, done: true } : item,
        ),
      }));

      void window.electronAPI?.notify?.(`${message.title}: ${message.text}`);
      void window.electronAPI?.showCompanion?.({
        position: state.position,
        message,
      });
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 1000);
    return () => window.clearInterval(timer);
  }, [publishCompanionMessage, state.reminders, state.position]);

  useEffect(() => {
    if (mode !== "companion") return;
    const syncFromStorage = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<AppState>;
        setState((current) => ({
          ...current,
          ...parsed,
          scale: Math.min(
            1.25,
            Math.max(0.55, Number(parsed.scale ?? current.scale)),
          ),
          bubbleScale: Math.min(1.25, Math.max(0.65, Number(parsed.bubbleScale ?? current.bubbleScale))),
          bubbleFontSize: Math.min(18, Math.max(10, Number(parsed.bubbleFontSize ?? current.bubbleFontSize))),
          bubbleMaxWidth: Math.min(260, Math.max(140, Number(parsed.bubbleMaxWidth ?? current.bubbleMaxWidth))),
        }));
      } catch {
        /* ignore malformed stale state */
      }
    };
    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, [mode]);

  useEffect(() => {
    if (!window.electronAPI?.onCompanionMessage) return;
    const removeListener = window.electronAPI.onCompanionMessage((message) => {
      const next = {
        id: crypto.randomUUID(),
        title: normalizeText(message.title ?? "Hey there!", "Hey there!", 60),
        text: normalizeText(
          message.text ?? "Ready when you are.",
          "Ready when you are.",
          180,
        ),
        meta: normalizeText(
          message.meta ?? "Developer status",
          "Developer status",
          60,
        ),
        source: (message.source as CompanionMessageSource) ?? "custom",
        priority: Number.isFinite(message.priority)
          ? Number(message.priority)
          : 80,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      };

      setState((current) => ({
        ...current,
        latestMessage: next,
        showBubble: true,
      }));
    });

    return removeListener;
  }, []);

  useEffect(() => {
    const datasetMode = mode === "dashboard" ? "dashboard" : "companion";
    document.documentElement.dataset.windowMode = datasetMode;
    document.body.dataset.windowMode = datasetMode;
    document.documentElement.dataset.theme = state.theme;
    document.body.dataset.theme = state.theme;

    if (mode === "companion") {
      const nextBounds = {
        ...getPositionPixels(state.position),
        width: 460,
        height: 500,
      };
      if (window.electronAPI?.moveCompanionWindow) {
        void window.electronAPI.moveCompanionWindow(nextBounds);
      }
    }
  }, [mode, state.position, state.theme]);

  const latestEligibleMessage = useMemo(
    () => getLatestEligibleMessage(state),
    [state, now],
  );

  const dashboardSections: DashboardSection[] = [
    "Reminders",
    "Git Judge",
    "Bubble UI",
  ];

  const recentJudgments = useMemo(
    () => state.judgments.slice(0, 4),
    [state.judgments],
  );
  const upcomingReminders = useMemo(
    () => state.reminders.filter((item) => !item.done).slice(0, 3),
    [state.reminders],
  );

  const update = (partial: Partial<AppState>) => {
    setState((current) => ({ ...current, ...partial }));
  };

  const restoreCompanion = async (position: ScreenPosition = "top-right") => {
    const nextMessage = getLatestEligibleMessage({ ...state, position });

    setState((current) => ({
      ...current,
      position,
      latestMessage: {
        ...nextMessage,
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      },
      showBubble: true,
    }));

    if (
      window.electronAPI?.restoreCompanion ||
      window.electronAPI?.showCompanion
    ) {
      const restore =
        window.electronAPI.restoreCompanion ??
        window.electronAPI.showCompanion!;
      const result = await restore({
        position,
        message: {
          title: nextMessage.title,
          text: nextMessage.text,
          meta: nextMessage.meta,
          source: nextMessage.source,
          priority: nextMessage.priority,
        },
      });

      if (result?.ok) {
        setState((current) => ({
          ...current,
          position,
          latestMessage: {
            ...nextMessage,
            expiresAt: new Date(Date.now() + 5_000).toISOString(),
          },
          showBubble: true,
        }));
      }
    }
  };

  const addRepo = async () => {
    const paths = await window.electronAPI?.openDirectoryDialog?.();
    if (!paths || paths.length === 0) return;
    const nextPath = paths[0];
    const valid = await window.electronAPI?.validateRepository?.(nextPath);
    if (!valid) {
      alert("Selected folder is not a valid Git repository.");
      return;
    }
    const branch = await window.electronAPI?.getBranch?.(nextPath);
    const commit = await window.electronAPI?.getLatestCommit?.(nextPath);
    const nextRepo = {
      id: crypto.randomUUID(),
      name: nextPath.split(/[\\/]/).filter(Boolean).at(-1) ?? "repo",
      path: nextPath,
      enabled: true,
      branch: branch || "main",
      latestHash: commit?.hash ?? "",
      lastJudged: commit?.date ?? new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      repositories: [nextRepo, ...current.repositories],
      repoCount: current.repositories.length + 1,
    }));
  };

  const judgeLatest = () => {
    if (state.repositories.length === 0) {
      alert("Add a Git repository before judging commits.");
      return;
    }
    const repo = state.repositories[0];
    const message = repo.latestHash
      ? `feat(ui): ship polished companion update`
      : "fix stuff";
    const result = judgeCommitMessage(message, {
      repository: repo.name,
      hash: repo.latestHash || "manual",
      style: state.judgeStyle,
      conventionalCommits: true,
    });
    const nextFeedback = getJudgeFeedback(
      state.judgeStyle,
      result.score,
      result.message,
    );
    const nextJudgment = {
      id: crypto.randomUUID(),
      repository: repo.name,
      message: result.message,
      score: result.score,
      verdict: result.verdict,
      feedback: nextFeedback,
      date: new Date().toISOString(),
    };

    const nextCompanionMessage: CompanionMessage = {
      id: crypto.randomUUID(),
      title: "Git Judge",
      text: `${nextJudgment.verdict} · ${nextJudgment.score}/100`,
      meta: repositoryLabel(repo.name),
      source: "git-judge",
      priority: 90,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5_000).toISOString(),
    };

    setState((current) => ({
      ...current,
      judgments: [nextJudgment, ...current.judgments],
      latestMessage: {
        ...nextCompanionMessage,
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      },
      showBubble: true,
    }));
    if (window.electronAPI?.updateCompanionMessage) {
      void window.electronAPI.updateCompanionMessage({
        title: nextCompanionMessage.title,
        text: nextCompanionMessage.text,
        meta: nextCompanionMessage.meta,
        source: nextCompanionMessage.source,
        priority: nextCompanionMessage.priority,
      });
    }

    if (window.electronAPI?.showCompanion) {
      void window.electronAPI.showCompanion({
        position: state.position,
        message: {
          title: nextCompanionMessage.title,
          text: nextCompanionMessage.text,
          meta: nextCompanionMessage.meta,
          source: nextCompanionMessage.source,
          priority: nextCompanionMessage.priority,
        },
      });
    }
  };

  const handleDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "companion") return;
    isDragging.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    (event.currentTarget as HTMLDivElement).dataset.dragOrigin =
      `${origin.x},${origin.y}`;
  };

  const handleDragging = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || mode !== "companion") return;
    const nextX = Math.max(16, event.clientX - 150);
    const nextY = Math.max(18, event.clientY - 80);
    if (window.electronAPI?.moveCompanionWindow) {
      void window.electronAPI.moveCompanionWindow({
        x: nextX,
        y: nextY,
        width: 460,
        height: 500,
      });
    }
  };

  const handleDragEnd = () => {
    isDragging.current = false;
  };

  if (mode === "companion") {
    return (
      <div
        className="companion-screen"
        onMouseDown={handleDragStart}
        onMouseMove={handleDragging}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <Canvas
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 1.25, 4.8], rotation: [0, 0, 0], fov: 38 }}
          onCreated={({ gl, camera }) => {
            gl.setClearColor(0x000000, 0);
            camera.lookAt(0, 0, 0);
          }}
          style={{ background: "transparent", width: "100%", height: "100%" }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 5]} intensity={0.8} />
          <Character
            character={state.selectedCharacter}
            stringMessage={latestEligibleMessage.text}
            bubbleTitle={latestEligibleMessage.title}
            bubbleMeta={latestEligibleMessage.meta}
            showBubble={state.showBubble}
            messageKey={latestEligibleMessage.id}
            scale={state.scale}
            bubbleScale={state.bubbleScale}
            bubbleFontSize={state.bubbleFontSize}
            bubbleBackground={state.bubbleBackground}
            bubbleTextColor={state.bubbleTextColor}
            bubbleAccentColor={state.bubbleAccentColor}
            bubbleMaxWidth={state.bubbleMaxWidth}
          />
        </Canvas>
      </div>
    );
  }

  return (
    <div className="dashboard-shell" data-theme={state.theme}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">P</div>
          <div>
            <h1>Desktop Companion</h1>
            <small>Kali companion</small>
          </div>
        </div>
        <nav className="nav-list">
          {dashboardSections.map((section) => (
            <button
              key={section}
              className={
                state.activeSection === section ? "nav-item active" : "nav-item"
              }
              onClick={() => update({ activeSection: section })}
            >
              {section}
            </button>
          ))}
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Desktop companion</p>
            <h2>{state.activeSection}</h2>
          </div>
          <div className="topbar-actions">
            <button
              className="ghost-button"
              onClick={() =>
                update({ theme: state.theme === "dark" ? "light" : "dark" })
              }
            >
              {state.theme === "dark" ? "Light" : "Dark"} mode
            </button>
            <button
              className="primary-button show-companion-button"
              title="Restore the floating companion to the top-right and show the latest eligible message."
              onClick={() => void restoreCompanion("top-right")}
            >
              🖥️ Show Companion
            </button>
          </div>
        </header>

        <section className="content-grid">
          {state.activeSection === "Overview" && (
            <>
              <div className="card wide-card">
                <div className="card-header">
                  <h3>Companion status</h3>
                  <span className="badge">online</span>
                </div>
                <div className="status-row">
                  <div>
                    <label>Character</label>
                    <strong>{state.selectedCharacter}</strong>
                  </div>
                  <div>
                    <label>Animation</label>
                    <strong>
                      {state.animationEnabled ? "enabled" : "paused"}
                    </strong>
                  </div>
                  <div>
                    <label>Latest message</label>
                    <strong>{latestEligibleMessage.title}</strong>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3>Recent Git judges</h3>
                </div>
                {recentJudgments.map((item) => (
                  <div className="list-row" key={item.id}>
                    <div>
                      <strong>{item.repository}</strong>
                      <small>{new Date(item.date).toLocaleDateString()}</small>
                    </div>
                    <span
                      className={
                        item.verdict === "Approved" ? "score good" : "score"
                      }
                    >
                      {item.score}
                    </span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-header">
                  <h3>Upcoming reminders</h3>
                </div>
                {upcomingReminders.map((item) => (
                  <div className="list-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.note}</small>
                    </div>
                    <span>{new Date(item.at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>

              <div className="card wide-card">
                <div className="card-header">
                  <h3>Quick actions</h3>
                </div>
                <div className="quick-actions">
                  <button onClick={addRepo}>Add repo</button>
                  <button onClick={judgeLatest}>Judge latest commit</button>
                  <button
                    onClick={() =>
                      update({
                        selectedCharacter:
                          state.selectedCharacter === "female"
                            ? "male"
                            : state.selectedCharacter === "male"
                              ? "penguin"
                              : "female",
                      })
                    }
                  >
                    Change character
                  </button>
                  <button onClick={() => void restoreCompanion("top-right")}>
                    Show companion
                  </button>
                </div>
              </div>
            </>
          )}

          {state.activeSection === "Companion" && (
            <>
              <div className="card wide-card">
                <div className="card-header">
                  <h3>Character gallery</h3>
                </div>
                <div className="gallery-grid">
                  {(["penguin", "female", "male"] as CharacterName[]).map(
                    (character) => (
                      <button
                        key={character}
                        className={
                          state.selectedCharacter === character
                            ? "gallery-item selected"
                            : "gallery-item"
                        }
                        onClick={() => update({ selectedCharacter: character })}
                      >
                        <span>{character}</span>
                        <small>
                          {character === "penguin"
                            ? "Playful"
                            : character === "female"
                              ? "Balanced"
                              : "Focused"}
                        </small>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="card">
                <label>
                  Scale <strong>{state.scale.toFixed(2)}x</strong>
                </label>
                <input
                  type="range"
                  min="0.7"
                  max="1.25"
                  step="0.05"
                  value={state.scale}
                  onChange={(event) =>
                    update({ scale: Number(event.target.value) })
                  }
                />
                <label>Position</label>
                <select
                  value={state.position}
                  onChange={(event) => {
                    const nextPosition = event.target.value as ScreenPosition;
                    update({ position: nextPosition });
                    void window.electronAPI?.repositionCompanion?.(
                      nextPosition,
                    );
                  }}
                >
                  <option value="top-left">Top left</option>
                  <option value="top-right">Top right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="bottom-center">Bottom center</option>
                  <option value="bottom-right">Bottom right</option>
                  <option value="center">Center</option>
                </select>
                <div className="card-actions compact-actions">
                  <button
                    onClick={() => {
                      update({ position: "top-right" });
                      void window.electronAPI?.repositionCompanion?.(
                        "top-right",
                      );
                    }}
                  >
                    Recenter top-right
                  </button>
                </div>
              </div>

              <div className="card">
                <label className="switch-row">
                  <span>Animation enabled</span>
                  <input
                    type="checkbox"
                    checked={state.animationEnabled}
                    onChange={(event) =>
                      update({ animationEnabled: event.target.checked })
                    }
                  />
                </label>
                <label className="switch-row">
                  <span>Bubble visible</span>
                  <input
                    type="checkbox"
                    checked={state.showBubble}
                    onChange={(event) =>
                      update({ showBubble: event.target.checked })
                    }
                  />
                </label>
              </div>
            </>
          )}

          {state.activeSection === "Git Judge" && (
            <>
              <div className="card wide-card">
                <div className="card-header">
                  <h3>Repository monitor</h3>
                </div>
                {state.repositories.length === 0 ? (
                  <div className="empty-state">
                    No repositories added yet. Add a repo to start offline
                    judging.
                  </div>
                ) : (
                  <div className="repo-list">
                    {state.repositories.map((repo) => (
                      <div className="repo-item" key={repo.id}>
                        <div>
                          <strong>{repo.name}</strong>
                          <small>{repo.path}</small>
                        </div>
                        <div className="repo-meta">
                          <span>{repo.branch}</span>
                          <button
                            onClick={() => update({ repoPath: repo.path })}
                          >
                            Use
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="card-actions">
                  <button onClick={addRepo}>Add local repo</button>
                  <button onClick={judgeLatest}>Judge latest commit</button>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3>Judgment history</h3>
                </div>
                {state.judgments.map((item) => (
                  <div className="judge-row" key={item.id}>
                    <strong>{item.repository}</strong>
                    <span>{item.verdict}</span>
                    <small>{item.score}/100</small>
                  </div>
                ))}
              </div>
            </>
          )}

          {state.activeSection === "Reminders" && (
            <>
              <div className="card wide-card">
                <div className="card-header">
                  <h3>Create a reminder</h3>
                  <span className="muted">
                    The companion will show your message at the scheduled time.
                  </span>
                </div>
                <form
                  className="field-grid reminder-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const at = new Date(reminderDateTime);
                    if (
                      !reminderTitle.trim() ||
                      !reminderMessage.trim() ||
                      !Number.isFinite(at.getTime()) ||
                      at.getTime() <= Date.now()
                    ) {
                      alert(
                        "Enter a title, message, and a future date and time.",
                      );
                      return;
                    }
                    const reminder = {
                      id: crypto.randomUUID(),
                      title: normalizeText(reminderTitle, "Reminder", 80),
                      note: normalizeText(reminderMessage, "It's time.", 220),
                      at: at.toISOString(),
                      done: false,
                    };
                    setState((current) => ({
                      ...current,
                      reminders: [...current.reminders, reminder].sort(
                        (a, b) =>
                          new Date(a.at).getTime() - new Date(b.at).getTime(),
                      ),
                    }));
                    setReminderTitle("");
                    setReminderMessage("");
                  }}
                >
                  <label>
                    Reminder title
                    <input
                      required
                      value={reminderTitle}
                      onChange={(event) => setReminderTitle(event.target.value)}
                      placeholder="e.g. Stand-up meeting"
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Date and time
                    <input
                      required
                      type="datetime-local"
                      value={reminderDateTime}
                      min={reminderMinDateTime}
                      onChange={(event) =>
                        setReminderDateTime(event.target.value)
                      }
                    />
                  </label>
                  <label className="reminder-message-field">
                    Message for your companion
                    <textarea
                      required
                      value={reminderMessage}
                      onChange={(event) =>
                        setReminderMessage(event.target.value)
                      }
                      placeholder="What should the companion remind you about?"
                      maxLength={220}
                      rows={3}
                    />
                  </label>
                  <div className="card-actions">
                    <button className="primary-button" type="submit">
                      Schedule reminder
                    </button>
                  </div>
                </form>
              </div>
              <div className="card wide-card">
                <div className="card-header">
                  <h3>Scheduled reminders</h3>
                  <span className="muted">
                    {state.reminders.filter((item) => !item.done).length} active
                  </span>
                </div>
                {state.reminders.length === 0 && (
                  <p className="empty-state">
                    No reminders yet. Create one above to get started.
                  </p>
                )}
                {state.reminders.map((reminder) => (
                  <div className="reminder-row" key={reminder.id}>
                    <div className="reminder-copy">
                      <strong>{reminder.title}</strong>
                      <small>{reminder.note}</small>
                      <small>{new Date(reminder.at).toLocaleString()}</small>
                    </div>
                    <div className="reminder-actions">
                      <span
                        className={
                          reminder.done ? "status-pill complete" : "status-pill"
                        }
                      >
                        {reminder.done
                          ? "Completed"
                          : new Date(reminder.at).getTime() <= now
                            ? "Due"
                            : "Scheduled"}
                      </span>
                      {!reminder.done && (
                        <button
                          type="button"
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              reminders: current.reminders.map((item) =>
                                item.id === reminder.id
                                  ? { ...item, done: true }
                                  : item,
                              ),
                            }))
                          }
                        >
                          Complete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setState((current) => ({
                            ...current,
                            reminders: current.reminders.filter(
                              (item) => item.id !== reminder.id,
                            ),
                          }))
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {state.activeSection === "Bubble UI" && (
            <>
              <div className="card wide-card">
                <div className="card-header">
                  <h3>Reminder bubble appearance</h3>
                  <span className="muted">Changes save automatically</span>
                </div>
                <div className="field-grid bubble-settings-grid">
                  <label>
                    Default greeting title
                    <input
                      type="text"
                      maxLength={60}
                      value={state.bubbleTitle}
                      onChange={(event) => update({ bubbleTitle: event.target.value.slice(0, 60) })}
                    />
                  </label>
                  <label>
                    Default greeting message
                    <textarea
                      rows={2}
                      maxLength={180}
                      value={state.bubbleText}
                      onChange={(event) => update({ bubbleText: event.target.value.slice(0, 180) })}
                    />
                  </label>
                  <label>
                    Default greeting subtitle
                    <input
                      type="text"
                      maxLength={60}
                      value={state.bubbleMeta}
                      onChange={(event) => update({ bubbleMeta: event.target.value.slice(0, 60) })}
                    />
                  </label>
                  <label>
                    Character
                    <select
                      value={state.selectedCharacter}
                      onChange={(event) =>
                        update({
                          selectedCharacter: event.target
                            .value as CharacterName,
                        })
                      }
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="penguin">Penguin</option>
                    </select>
                  </label>
                  <label>
                    Character scale · {state.scale.toFixed(2)}×
                    <input
                      type="range"
                      min="0.55"
                      max="1.25"
                      step="0.05"
                      value={state.scale}
                      onChange={(event) =>
                        update({ scale: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Bubble scale · {state.bubbleScale.toFixed(2)}×
                    <input
                      type="range"
                      min="0.65"
                      max="1.25"
                      step="0.05"
                      value={state.bubbleScale}
                      onChange={(event) =>
                        update({ bubbleScale: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Font size · {state.bubbleFontSize}px
                    <input
                      type="range"
                      min="10"
                      max="18"
                      step="1"
                      value={state.bubbleFontSize}
                      onChange={(event) =>
                        update({ bubbleFontSize: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Bubble width · {state.bubbleMaxWidth}px
                    <input
                      type="range"
                      min="140"
                      max="260"
                      step="10"
                      value={state.bubbleMaxWidth}
                      onChange={(event) =>
                        update({ bubbleMaxWidth: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Bubble background
                    <input
                      type="color"
                      value={state.bubbleBackground}
                      onChange={(event) =>
                        update({ bubbleBackground: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Text color
                    <input
                      type="color"
                      value={state.bubbleTextColor}
                      onChange={(event) =>
                        update({ bubbleTextColor: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Title/accent color
                    <input
                      type="color"
                      value={state.bubbleAccentColor}
                      onChange={(event) =>
                        update({ bubbleAccentColor: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="card-actions">
                  <button
                    onClick={() =>
                      update({
                        scale: 0.8,
                        bubbleScale: 0.85,
                        bubbleFontSize: 12,
                        bubbleMaxWidth: 190,
                        bubbleBackground: "#fff1d1",
                        bubbleTextColor: "#242424",
                        bubbleAccentColor: "#c77713",
                      })
                    }
                  >
                    Reset appearance
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => void restoreCompanion(state.position)}
                  >
                    Preview on companion
                  </button>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <h3>Live preview</h3>
                </div>
                <div
                  className="preview-box"
                  style={{
                    background: state.bubbleBackground,
                    color: state.bubbleTextColor,
                    borderColor: state.bubbleAccentColor,
                    transform: `scale(${Math.min(1.2, state.bubbleScale)})`,
                    transformOrigin: "top left",
                  }}
                >
                  <h4
                    style={{
                      color: state.bubbleAccentColor,
                      fontSize: state.bubbleFontSize,
                    }}
                  >
                    {state.bubbleTitle || "Reminder title"}
                  </h4>
                  <p style={{ fontSize: state.bubbleFontSize }}>
                    {state.bubbleText || "Your reminder message appears here."}
                  </p>
                  <small style={{ color: state.bubbleTextColor }}>
                    {state.bubbleMeta}
                  </small>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function repositoryLabel(value: string) {
  return value || "local repository";
}

export default App;
