import { formatDateTime, formatRating, formatRelativeTime, renderAvatar, escapeHtml } from "../utils/helpers.js";
import { getDashboardInsights, getLevelProgress } from "../utils/progression.js";

export function renderDashboardView(state) {
  const currentUserId = state.user.uid;
  const mine = state.marketplace.filter((listing) => listing.uid === currentUserId);
  const openTrades = (state.trades || []).filter((trade) => !["completed", "cancelled", "rejected"].includes(trade.status));
  const listings = state.marketplace.slice(0, 4);
  const recentConversations = state.conversations.slice(0, 4);
  const progress = getLevelProgress(state.user);
  const listingsCreated = Math.max(Number(state.user.totalListingsCreated) || 0, mine.length);
  const insights = getDashboardInsights(state.user, listingsCreated);

  const levelColors = {
    "Beginner":     "badge",
    "Intermediate": "badge-brand",
    "Expert":       "badge-success"
  };

  const tradeStatusClass = (status) => ({
    requested: "status-requested",
    accepted:  "status-accepted",
    completed: "status-completed",
    cancelled: "status-cancelled",
    rejected:  "status-rejected"
  }[status] || "badge");

  return `
    <section class="page-section animate-fade-in">

      <!-- ── Hero Row ── -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

        <!-- Profile card -->
        <div class="card md:col-span-2 flex-row items-center gap-5">
          <div class="w-16 h-16 rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-2xl"
               style="background: var(--surface-muted); color: var(--accent);">
            ${renderAvatar(state.user, "w-full h-full flex items-center justify-center")}
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <h1 class="font-headline-md font-bold text-xl text-primary truncate">${escapeHtml(state.user.name)}</h1>
              <span class="${levelColors[progress.level] || "badge"}">${escapeHtml(progress.level)}</span>
            </div>
            <p class="text-sm text-on-surface-variant mb-2">${escapeHtml(state.user.headline || "SkillEX member")}</p>
            <div class="flex items-center gap-1 text-xs text-on-surface-variant">
              <span class="material-symbols-outlined" style="font-size:14px; color: var(--warning);">star</span>
              <span class="font-semibold text-primary">${formatRating(progress.rating)}</span>
              <span>· ${progress.tradesCompleted} trades</span>
            </div>
          </div>
        </div>

        <!-- Credits card -->
        <div class="card flex-row items-center justify-between md:flex-col md:items-start md:justify-between"
             style="background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%); border-color: transparent; color: #fff;">
          <div>
            <p class="text-xs font-semibold opacity-80 mb-1 uppercase tracking-wider">Available Credits</p>
            <div class="font-headline-md font-bold text-3xl">${state.user.credits || 0}
              <span class="text-base font-semibold opacity-70">CRD</span>
            </div>
          </div>
          <button class="flex items-center gap-1 text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity mt-2"
                  data-route="trades">
            View history
            <span class="material-symbols-outlined" style="font-size:14px;">arrow_forward</span>
          </button>
        </div>
      </div>

      <!-- ── Level Progress ── -->
      <div class="card">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-0.5">Progress</p>
            <h2 class="text-base font-bold text-primary">
              ${progress.nextLevel ? `${progress.level} → ${progress.nextLevel}` : "Max level reached 🎉"}
            </h2>
          </div>
          <!-- Level milestones -->
          <div class="flex items-center gap-1.5">
            ${["Beginner", "Intermediate", "Expert"].map(lvl => `
              <span class="${lvl === progress.level ? "badge-brand" : "badge"}">${lvl}</span>
            `).join('<span class="text-outline text-xs mx-0.5">›</span>')}
          </div>
        </div>
        <div class="relative w-full h-2 rounded-full overflow-hidden" style="background: var(--surface-muted);">
          <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
               style="width:${progress.progressPercent}%; background: var(--accent);"></div>
        </div>
        <div class="flex justify-between text-xs text-on-surface-variant mt-2">
          <span>${progress.tradesCompleted} trades completed</span>
          <span>${progress.nextTradeTarget ? `${progress.nextTradeTarget} to next level` : "Max level"}</span>
        </div>
      </div>

      <!-- ── Stat Cards ── -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        ${[
          { icon: "sync_alt",     label: "Trades Completed", value: progress.tradesCompleted,  color: "var(--accent)" },
          { icon: "format_list_bulleted", label: "Listings Created",  value: listingsCreated,          color: "var(--info)" },
          { icon: "star",         label: "Global Rating",    value: formatRating(progress.rating), color: "var(--warning)" }
        ].map(stat => `
          <div class="card flex-row items-center gap-4">
            <div class="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                 style="background: ${stat.color}1a; color: ${stat.color};">
              <span class="material-symbols-outlined">${stat.icon}</span>
            </div>
            <div>
              <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">${stat.label}</p>
              <p class="text-2xl font-bold font-headline-md text-primary">${stat.value}</p>
            </div>
          </div>
        `).join("")}
      </div>

      <!-- ── Activity Feed ── -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- Marketplace activity -->
        <div class="card">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-primary">Fresh Marketplace Activity</h3>
            <button class="text-xs font-semibold hover:text-primary transition-colors"
                    style="color: var(--accent);" data-route="marketplace">View all →</button>
          </div>
          ${listings.length ? `
            <div class="flex flex-col gap-2">
              ${listings.map(listing => `
                <div class="flex items-start gap-3 p-3 rounded-lg border border-outline-variant transition-colors hover:border-outline"
                     style="background: var(--surface-muted);">
                  <div class="w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold"
                       style="background: var(--surface-soft); color: var(--accent);">
                    ${renderAvatar(listing, "w-full h-full flex items-center justify-center")}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-primary truncate">${escapeHtml(listing.title)}</p>
                    <p class="text-xs text-on-surface-variant truncate">${escapeHtml(listing.name)} · ${formatRelativeTime(listing.createdAt)}</p>
                  </div>
                  <span class="badge shrink-0">${escapeHtml(listing.priceLabel || listing.listingType || "")}</span>
                </div>
              `).join("")}
            </div>
          ` : `
            <div class="flex flex-col items-center justify-center py-8 text-center">
              <span class="material-symbols-outlined text-on-surface-variant mb-2" style="font-size:32px;">storefront</span>
              <p class="text-sm text-on-surface-variant">No marketplace activity yet</p>
            </div>
          `}
        </div>

        <!-- Right column: Trades + Messages -->
        <div class="flex flex-col gap-4">

          <!-- Active Trades -->
          <div class="card">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-primary">Active Trades</h3>
              <button class="text-xs font-semibold hover:text-primary transition-colors"
                      style="color: var(--accent);" data-route="trades">Manage →</button>
            </div>
            ${openTrades.length ? `
              <div class="flex flex-col gap-2">
                ${openTrades.slice(0, 3).map(trade => `
                  <div class="flex items-center justify-between p-3 rounded-lg border border-outline-variant"
                       style="background: var(--surface-muted);">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold text-primary truncate">${escapeHtml(trade.listingTitle || "Trade request")}</p>
                      <p class="text-xs text-on-surface-variant">${formatDateTime(trade.updatedAt || trade.createdAt)}</p>
                    </div>
                    <span class="${tradeStatusClass(trade.status || "requested")} ml-2 shrink-0">${escapeHtml(trade.status || "requested")}</span>
                  </div>
                `).join("")}
              </div>
            ` : `
              <div class="text-center py-6">
                <p class="text-sm text-on-surface-variant">No active trades</p>
              </div>
            `}
          </div>

          <!-- Recent Conversations -->
          <div class="card">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-primary">Recent Conversations</h3>
              <button class="text-xs font-semibold hover:text-primary transition-colors"
                      style="color: var(--accent);" data-route="messages">Inbox →</button>
            </div>
            ${recentConversations.length ? `
              <div class="flex flex-col gap-2">
                ${recentConversations.map(conv => `
                  <button class="flex flex-col items-start text-left p-3 rounded-lg border border-outline-variant transition-colors hover:border-outline w-full"
                          style="background: var(--surface-muted);" data-route="messages">
                    <p class="text-sm font-semibold text-primary truncate w-full">${escapeHtml(conv.lastMessage || conv.lastMsg || "Open conversation")}</p>
                    <p class="text-xs text-on-surface-variant">${formatRelativeTime(conv.lastMessageAt || conv.lastTime)}</p>
                  </button>
                `).join("")}
              </div>
            ` : `
              <div class="text-center py-6">
                <p class="text-sm text-on-surface-variant">No conversations yet</p>
              </div>
            `}
          </div>

        </div>
      </div>

    </section>
  `;
}
