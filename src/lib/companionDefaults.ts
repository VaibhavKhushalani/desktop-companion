export const DEFAULT_COMPANION_MESSAGE = {
  id: "default-greeting",
  title: "Hey there!",
  text: "Your companion is ready to help.",
  meta: "Developer status",
  source: "greeting" as const,
  priority: 25,
  createdAt: new Date().toISOString(),
};

export const DEFAULT_COMPANION_UI = {
  selectedCharacter: "female" as const,
  theme: "dark" as const,
  position: "top-right" as const,
  showBubble: true,
  scale: 0.8,
  bubbleScale: 0.85,
  bubbleFontSize: 12,
  bubbleBackground: "#fff1d1",
  bubbleTextColor: "#242424",
  bubbleAccentColor: "#c77713",
  bubbleMaxWidth: 190,
  animationEnabled: true,
  autoJudge: true,
  judgeStyle: "friendly" as const,
};

export const DEFAULT_REMINDER_SETTINGS = {
  leadMinutes: 5,
  minLeadSeconds: 60,
};
