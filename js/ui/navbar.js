import { ROUTE_TITLES, escapeHtml, formatRelativeTime, renderAvatar } from "../utils/helpers.js";

const NAV_ITEMS = [
  { route: "dashboard",      label: "Dashboard",      icon: "grid_view"    },
  { route: "marketplace",    label: "Marketplace",    icon: "storefront"   },
  { route: "create-listing", label: "Create Listing", icon: "add_circle"   },
  { route: "trades",         label: "Trades",         icon: "sync_alt"     },
  { route: "messages",       label: "Messages",       icon: "forum"        },
  { route: "profile",        label: "Profile",        icon: "person"       }
];

function renderCreditHistory(creditTransactions = []) {
  if (!creditTransactions.length) {
    return `<div class="px-4 py-6 text-center text-xs text-on-surface-variant">No transactions yet.</div>`;
  }

  const rows = creditTransactions.slice(0, 30);
  return rows.map((tx) => {
    const amount = Number(tx.amount) || 0;
    const isPositive = amount >= 0;
    const sign = isPositive ? "+" : "";
    const colorClass = isPositive ? "text-emerald-400" : "text-red-400";
    return `
      <div class="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-outline-variant/30 last:border-b-0">
        <div class="flex flex-col min-w-0">
          <span class="text-xs font-medium text-on-surface truncate">${escapeHtml(tx.reason || "Update")}</span>
          <span class="text-[10px] text-on-surface-variant">${formatRelativeTime(tx.createdAt)}</span>
        </div>
        <span class="text-xs font-bold shrink-0 ${colorClass}">${sign}${amount} CRD</span>
      </div>`;
  }).join("");
}

export function renderAppShell({ route, user, content, notifications = [], creditTransactions = [] }) {
  const unreadCount = notifications.filter((n) => n.unread).length;

  const notificationItems = notifications.length
    ? notifications
        .slice(0, 15)
        .map((n) => ({ text: n.text || n.message || "", unread: Boolean(n.unread), id: n.id || "" }))
        .filter((n) => n.text)
    : [
        { text: "Welcome to SkillEX. Your dashboard is ready.", unread: false },
        { text: "New marketplace listings are available.", unread: false }
      ];

  const credits = Number(user.credits) || 0;

  return `
    <div class="min-h-screen bg-background flex flex-col">

      <!-- ── Top Navbar ── -->
      <header class="navbar">
        <div class="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">

          <!-- Logo -->
          <button class="flex items-center gap-2 shrink-0" data-route="dashboard">
            <div class="w-7 h-7 rounded-md flex items-center justify-center" style="background: var(--accent);">
              <span class="material-symbols-outlined text-white" style="font-size:15px;">bolt</span>
            </div>
            <span class="font-headline-md font-bold text-base tracking-tight text-primary hidden sm:inline">
              Skill<span style="color:var(--accent)">EX</span>
            </span>
          </button>

          <!-- Desktop Nav Links -->
          <nav class="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            ${NAV_ITEMS.map((item) => `
              <button
                class="flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium transition-all duration-150
                  ${route === item.route
                    ? "text-primary bg-surface-muted"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-muted"
                  }"
                data-route="${item.route}"
                aria-label="${item.label}"
              >
                <span class="material-symbols-outlined" style="font-size:16px;">${item.icon}</span>
                <span class="hidden lg:inline">${item.label}</span>
              </button>
            `).join("")}
          </nav>

          <!-- Right Actions -->
          <div class="flex items-center gap-1.5 shrink-0">

            <!-- Credits Display + History Dropdown -->
            <div class="relative">
              <button
                class="flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-semibold transition-all duration-150 hover:bg-surface-muted"
                style="color: var(--accent);"
                data-action="toggle-credit-history"
                aria-label="Credit balance and history"
                title="Credits"
              >
                <span class="material-symbols-outlined" style="font-size:16px;">toll</span>
                <span class="tabular-nums font-bold">${credits}</span>
              </button>
              <!-- Credit History Panel -->
              <div
                class="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-24px)] bg-surface border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden hidden"
                data-credit-history-panel
              >
                <div class="px-4 py-3 border-b border-outline-variant flex items-center justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-primary">Credit History</p>
                    <p class="text-xs text-on-surface-variant">Balance: <strong class="text-primary">${credits} CRD</strong></p>
                  </div>
                  <span class="material-symbols-outlined text-primary" style="font-size:18px;">account_balance_wallet</span>
                </div>
                <div class="max-h-72 overflow-y-auto overscroll-contain">
                  ${renderCreditHistory(creditTransactions)}
                </div>
              </div>
            </div>

            <!-- Notifications -->
            <div class="relative">
              <button class="icon-btn relative" aria-label="Notifications" data-action="toggle-notifications">
                <span class="material-symbols-outlined">notifications</span>
                ${unreadCount ? `<span class="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] leading-[14px] text-center font-bold" style="background:var(--danger); color:white;">${Math.min(unreadCount, 99)}</span>` : ""}
              </button>
              <div class="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-24px)] bg-surface border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden hidden" data-notifications-panel>
                <div class="px-4 py-3 border-b border-outline-variant">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-sm font-semibold text-primary">Notifications</p>
                    ${unreadCount ? `<button type="button" class="text-xs text-primary hover:underline" data-action="mark-all-notifications-read">Mark all read</button>` : ""}
                  </div>
                </div>
                <div class="py-1 max-h-80 overflow-y-auto overscroll-contain">
                  ${notificationItems.map((n) => `
                    <div class="px-4 py-2.5 text-sm text-on-surface border-b border-outline-variant/40 last:border-b-0 ${n.unread ? "bg-primary/5" : ""}">
                      ${escapeHtml(n.text)}
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>

            <!-- Theme toggle -->
            <button class="icon-btn hidden sm:flex" data-action="toggle-theme" aria-label="Toggle theme">
              <span class="material-symbols-outlined">contrast</span>
            </button>

            <!-- Avatar Dropdown -->
            <div class="relative">
              <button class="w-8 h-8 rounded-full overflow-hidden border-2 transition-all duration-150 flex items-center justify-center font-bold text-sm"
                style="border-color: var(--line); background: var(--surface-muted); color: var(--accent);"
                aria-label="User menu"
                data-action="toggle-profile-menu">
                ${renderAvatar(user, "w-full h-full flex items-center justify-center")}
              </button>

              <div class="absolute right-0 top-full mt-2 w-56 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden hidden" data-profile-menu>
                <div class="px-4 py-3 border-b border-outline-variant">
                  <p class="text-sm font-semibold text-primary truncate">${escapeHtml(user.name)}</p>
                  <p class="text-xs text-on-surface-variant truncate">${escapeHtml(user.email)}</p>
                  <div class="flex items-center gap-1 mt-1">
                    <span class="material-symbols-outlined text-amber-400" style="font-size:12px;">star</span>
                    <span class="text-xs font-semibold text-on-surface-variant">${Number(user.rating || 0).toFixed(1)} · ${escapeHtml(user.level || "Beginner")}</span>
                  </div>
                </div>
                <div class="py-1">
                  <button class="w-full text-left flex items-center gap-2.5 px-4 py-2 text-sm text-on-surface hover:bg-surface-muted transition-colors" data-route="profile">
                    <span class="material-symbols-outlined" style="font-size:16px;">person</span>
                    Profile
                  </button>
                  <button class="w-full text-left flex items-center gap-2.5 px-4 py-2 text-sm text-on-surface hover:bg-surface-muted transition-colors" data-action="toggle-theme">
                    <span class="material-symbols-outlined" style="font-size:16px;">contrast</span>
                    Toggle Theme
                  </button>
                  <div class="border-t border-outline-variant/40 my-1"></div>
                  <button class="w-full text-left flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-surface-muted" style="color: var(--danger);" data-action="logout">
                    <span class="material-symbols-outlined" style="font-size:16px;">logout</span>
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile Nav Bar -->
        <div class="md:hidden flex overflow-x-auto border-t border-outline-variant bg-surface scrollbar-hide" style="height:44px;">
          ${NAV_ITEMS.map((item) => `
            <button
              class="flex-shrink-0 flex items-center gap-1 px-4 h-full text-xs font-medium transition-colors border-b-2
                ${route === item.route ? "border-brand text-primary" : "border-transparent text-on-surface-variant"}"
              data-route="${item.route}"
            >
              <span class="material-symbols-outlined" style="font-size:16px;">${item.icon}</span>
              ${item.label}
            </button>
          `).join("")}
        </div>
      </header>

      <!-- ── Main Content ── -->
      <main class="flex-grow flex flex-col bg-background" id="route-view" style="padding-top: 64px;">
        <div class="md:hidden" style="height:44px;"></div>
      </main>

      <!-- ── Footer ── -->
      <footer class="border-t border-outline-variant py-5 bg-surface mt-auto">
        <div class="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
          <span>© 2025 SkillEX. All rights reserved.</span>
          <div class="flex gap-5">
            <button class="hover:text-primary transition-colors">Privacy</button>
            <button class="hover:text-primary transition-colors">Terms</button>
            <button class="hover:text-primary transition-colors">Help</button>
          </div>
        </div>
      </footer>
    </div>
  `;
}
