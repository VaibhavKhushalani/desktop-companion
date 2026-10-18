export type JudgeStyle = "friendly" | "funny" | "strict" | "professional";
export type Verdict = "Approved" | "Needs Work" | "Rejected";

export type CommitJudgment = {
  repository: string;
  hash: string;
  message: string;
  score: number;
  verdict: Verdict;
  explanation: string;
  suggestion: string;
  style: JudgeStyle;
  date: string;
};

export const DEFAULT_GIT_RULES = {
  conventionalCommits: true,
  scoreFloor: 0,
  style: "friendly" as JudgeStyle,
};

const GENERIC_WORDS = new Set([
  "update",
  "fix",
  "stuff",
  "misc",
  "changes",
  "wip",
  "miscellaneous",
  "refactor",
  "tweak",
  "patch",
  "adjust",
  "improve",
]);

function cleanMessage(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function conventionalCommitScore(message: string) {
  const pattern =
    /^(feat|fix|docs|chore|refactor|perf|style|test|build|ci|revert)(\([^)]+\))?:\s.+$/i;
  if (pattern.test(message)) return 12;
  return 0;
}

export function judgeCommitMessage(
  message: string,
  options: {
    repository?: string;
    hash?: string;
    style?: JudgeStyle;
    conventionalCommits?: boolean;
  } = {},
): CommitJudgment {
  const repo = options.repository ?? "local";
  const hash = options.hash ?? "manual";
  const style = options.style ?? DEFAULT_GIT_RULES.style;
  const conventionalCommits =
    options.conventionalCommits ?? DEFAULT_GIT_RULES.conventionalCommits;

  const trimmed = cleanMessage(message);
  let score = 100;
  const issues: string[] = [];

  if (!trimmed) {
    return {
      repository: repo,
      hash,
      message: message || "",
      score: 0,
      verdict: "Rejected",
      explanation:
        "Empty commit message. Add a clear description of the change.",
      suggestion:
        "Use a message like 'fix(auth): handle expired refresh tokens'.",
      style,
      date: new Date().toISOString(),
    };
  }

  if (trimmed.length < 8) {
    score -= 28;
    issues.push("too short to describe the change well");
  }

  if (trimmed.length > 120) {
    score -= 10;
    issues.push("overly long for a concise commit summary");
  }

  const words = trimmed.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (uniqueWords.size < 3) {
    score -= 15;
    issues.push("repeats words without adding context");
  }

  const lower = trimmed.toLowerCase();
  const genericHits = words.filter((word) => GENERIC_WORDS.has(word));
  if (genericHits.length > 0) {
    score -= genericHits.length * 12;
    issues.push("uses vague, non-specific wording");
  }

  if (
    /\b(update|fix|change|stuff|misc|wip)\b/i.test(lower) &&
    words.length <= 3
  ) {
    score -= 18;
    issues.push("too generic to help future maintainers");
  }

  if (!/[a-z]/i.test(trimmed) || !/[0-9A-Za-z]/.test(trimmed)) {
    score -= 8;
    issues.push("lacks usable detail");
  }

  if (conventionalCommits) {
    const ccBonus = conventionalCommitScore(trimmed);
    if (ccBonus > 0) score += ccBonus;
    else {
      score -= 10;
      issues.push("does not follow conventional commit formatting");
    }
  }

  if (lower.includes("todo") || lower.includes("later")) {
    score -= 10;
    issues.push("does not describe the final state of the change");
  }

  if (/[.;]{2,}/.test(trimmed)) {
    score -= 4;
    issues.push("contains awkward punctuation");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict: Verdict = "Approved";
  if (score < 50) verdict = "Rejected";
  else if (score < 75) verdict = "Needs Work";

  const explanation =
    issues.length > 0
      ? `The message is understandable but ${issues[0]}${issues.length > 1 ? "; it also reads a bit too generically" : ""}.`
      : "Clear, scoped, and useful. Approved.";

  const suggestion =
    score >= 80
      ? "Keep the scope and impact explicit. A short conventional summary is ideal."
      : "Add the actual behavior change, the impacted area, and a concise result to improve clarity.";

  return {
    repository: repo,
    hash,
    message: trimmed,
    score,
    verdict,
    explanation,
    suggestion,
    style,
    date: new Date().toISOString(),
  };
}

export function getJudgeFeedback(
  style: JudgeStyle,
  score: number,
  message: string,
): string {
  if (style === "funny") {
    if (score >= 80)
      return `Solid commit. ${message} actually explains itself.`;
    if (score >= 50)
      return "A decent attempt, but the commit message still needs a clue-filled map.";
    return "The legendary mystery commit. Future you will need archaeological tools to understand this.";
  }

  if (style === "strict") {
    if (score >= 80) return "Clear, scoped, and useful. Approved.";
    if (score >= 50)
      return "Readable, but it still needs clearer impact and scope.";
    return "This commit message lacks context. Tell readers what changed and why.";
  }

  if (style === "professional") {
    if (score >= 80) return "A commit message that actually explains itself.";
    if (score >= 50)
      return "The change is mostly understandable, but the message could be more specific.";
    return "Update what? Give your future self some context.";
  }

  if (score >= 80) return "Clear, scoped, and useful. Approved.";
  if (score >= 50)
    return "The message is close, but a bit more detail would make it much easier to review.";
  return "This needs more context. What changed, where, and why?";
}
