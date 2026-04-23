export const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Urdu"
];

export const MARKETPLACE_CATEGORIES = [
  "General",
  "Books",
  "Coding",
  "Design",
  "Languages",
  "Music",
  "Career",
  "Academics"
];

export const LISTING_TYPES = [
  { value: "skill", label: "Skill" },
  { value: "book", label: "Book" },
  { value: "service", label: "Service" },
  { value: "resource", label: "Resource" }
];

export const CREATE_LISTING_TYPES = [
  { value: "skill", label: "Skill" },
  { value: "resource", label: "Resource" }
];

export const ROUTE_TITLES = {
  dashboard: "Dashboard",
  marketplace: "Marketplace",
  "create-listing": "Create Listing",
  trades: "Trades",
  messages: "Messages",
  profile: "Profile"
};

const AVATAR_PALETTES = [
  { accent: "#3ecf8e", surface: "rgba(62, 207, 142, 0.16)" },
  { accent: "#57a6ff", surface: "rgba(87, 166, 255, 0.16)" },
  { accent: "#f7b955", surface: "rgba(247, 185, 85, 0.16)" },
  { accent: "#ff6b81", surface: "rgba(255, 107, 129, 0.16)" },
  { accent: "#8d9fff", surface: "rgba(141, 159, 255, 0.16)" },
  { accent: "#69d4cf", surface: "rgba(105, 212, 207, 0.16)" }
];

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SX";
}

export function pickPalette(seed = "") {
  const score = Array.from(String(seed)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_PALETTES[score % AVATAR_PALETTES.length];
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return "just now";
  }

  const diff = Date.now() - Number(timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return "just now";
  }

  if (diff < hour) {
    return `${Math.floor(diff / minute)}m ago`;
  }

  if (diff < day) {
    return `${Math.floor(diff / hour)}h ago`;
  }

  return `${Math.floor(diff / day)}d ago`;
}

export function formatDateTime(timestamp) {
  if (!timestamp) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(Number(timestamp)));
}

export function formatDateTimeLocal(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(Number(timestamp));
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function makeChatId(left, right) {
  return [left, right].sort().join("_");
}

export function getRoutePath(route) {
  return route === "dashboard" ? "#/" : `#/${route}`;
}

export function normaliseTags(rawValue = "") {
  return rawValue
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function getConversationPartnerId(conversation, currentUserId) {
  return (conversation.participants || []).find((participantId) => participantId !== currentUserId) || null;
}

export function renderAvatar(user, className = "avatar") {
  const palette = {
    accent: user?.accentColor || user?.color || pickPalette(user?.uid || user?.email || user?.name || "").accent,
    surface: user?.accentSurface || user?.bg || pickPalette(user?.uid || user?.email || user?.name || "").surface
  };

  return `
    <span
      class="${className}"
      style="background:${palette.surface};color:${palette.accent}"
      aria-hidden="true"
    >${escapeHtml(createInitials(user?.name || user?.email || "SkillEx"))}</span>
  `;
}

export function formatRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) {
    return "0.0";
  }

  return rating.toFixed(1);
}
