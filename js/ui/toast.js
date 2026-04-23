let host;

function ensureHost() {
  if (host) return host;
  host = document.createElement("div");
  host.className = "fixed top-24 right-4 md:top-4 md:right-4 z-[60] flex flex-col gap-3 pointer-events-none w-full max-w-[320px]";
  document.body.append(host);
  return host;
}

export function initToastHost() {
  ensureHost();
}

export function showToast({ title, description = "", tone = "info", timeout = 3200 }) {
  const root = ensureHost();
  const toast = document.createElement("div");
  // Map tone to CSS class and icon
  const toneMap = {
    success: { cls: "border-emerald-500/30 bg-surface",  icon: "check_circle",  color: "text-emerald-400" },
    danger:  { cls: "border-red-500/30 bg-surface",      icon: "error",         color: "text-red-400"     },
    error:   { cls: "border-red-500/30 bg-surface",      icon: "error",         color: "text-red-400"     },
    warning: { cls: "border-amber-500/30 bg-surface",    icon: "warning",       color: "text-amber-400"   },
    info:    { cls: "border-primary/20 bg-surface",      icon: "info",          color: "text-primary"     }
  };
  const { cls, icon, color } = toneMap[tone] || toneMap.info;

  toast.className = `toast pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-sm animate-fade-in ${cls}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined ${color} text-[20px] shrink-0 mt-0.5">${icon}</span>
    <div class="flex flex-col gap-0.5 w-full">
      <strong class="text-sm font-bold text-primary leading-snug">${title}</strong>
      ${description ? `<span class="text-xs text-on-surface-variant leading-relaxed">${description}</span>` : ""}
    </div>
    <button class="shrink-0 text-on-surface-variant hover:text-primary transition-colors mt-0.5" onclick="this.closest('.toast').remove()">
      <span class="material-symbols-outlined text-[16px]">close</span>
    </button>
  `;

  root.append(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(8px)";
    toast.style.transition = "opacity 200ms, transform 200ms";
    window.setTimeout(() => toast.remove(), 220);
  }, timeout);
}
