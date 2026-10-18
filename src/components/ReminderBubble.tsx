type ReminderBubbleProps = {
  title?: string;
  text?: string;
  meta?: string;
  compact?: boolean;
  fontSize?: number;
  background?: string;
  textColor?: string;
  accentColor?: string;
  maxWidth?: number;
};

export default function ReminderBubble({
  title = "Reminder",
  text = "It's time for your reminder.",
  meta = "",
  compact = false,
  fontSize = 14,
  background = "#fff1d1",
  textColor = "#242424",
  accentColor = "#c77713",
  maxWidth = 200,
}: ReminderBubbleProps) {
  const size = Math.max(10, Math.min(18, fontSize));
  return (
    <div
      className={`reminder-bubble ${compact ? "compact" : ""}`}
      style={{
        width: "max-content",
        maxWidth: `min(${Math.max(140, Math.min(260, maxWidth))}px, calc(100vw - 28px))`,
        overflowWrap: "anywhere",
        boxSizing: "border-box",
        padding: `${Math.max(7, size * 0.5)}px ${Math.max(9, size * 0.7)}px`,
        borderRadius: `${Math.max(10, size * 0.9)}px`,
        background,
        color: textColor,
        fontSize: `${size}px`,
        borderColor: `${accentColor}55`,
      }}
    >
      {title ? <strong style={{ color: accentColor, fontSize: "1em" }}>{title}</strong> : null}
      <p>{text}</p>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}
