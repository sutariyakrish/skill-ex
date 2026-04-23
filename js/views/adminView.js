import { escapeHtml, formatRelativeTime } from "../utils/helpers.js";

export function renderAdminView(state) {
  const { adminStats, adminReports, adminUsers, adminTab } = state.admin || {};
  const tab = adminTab || "overview";

  const statCards = adminStats
    ? [
        { icon: "group", label: "Total Users", value: adminStats.totalUsers, color: "text-blue-400" },
        { icon: "storefront", label: "Total Listings", value: adminStats.totalListings, color: "text-emerald-400" },
        { icon: "swap_horiz", label: "Total Trades", value: adminStats.totalTrades, color: "text-violet-400" },
        { icon: "check_circle", label: "Completed", value: adminStats.completedTrades, color: "text-emerald-400" },
        { icon: "pending", label: "Pending Trades", value: adminStats.pendingTrades, color: "text-amber-400" },
        { icon: "flag", label: "Open Reports", value: adminStats.openReports, color: "text-red-400" }
      ]
    : [];

  return `
    <section class="page-section animate-fade-in" style="max-width:1100px;margin:0 auto;">

      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-3xl">admin_panel_settings</span>
          <div>
            <h1 class="font-headline-md text-2xl font-bold text-on-surface">Admin Dashboard</h1>
            <p class="text-xs text-on-surface-variant">Platform management &amp; moderation</p>
          </div>
        </div>
        <button type="button" class="btn-ghost text-xs flex items-center gap-1" data-action="admin-refresh">
          <span class="material-symbols-outlined" style="font-size:16px;">refresh</span> Refresh
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 p-1 bg-surface-muted rounded-xl w-fit">
        ${[
          { id: "overview", icon: "dashboard", label: "Overview" },
          { id: "reports", icon: "flag", label: "Reports" },
          { id: "users", icon: "group", label: "Users" }
        ].map((t) => `
          <button type="button"
            class="px-4 h-9 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${tab === t.id ? "bg-primary text-on-primary shadow" : "text-on-surface-variant hover:text-on-surface"}"
            data-action="admin-tab" data-tab="${t.id}">
            <span class="material-symbols-outlined" style="font-size:15px;">${t.icon}</span>${t.label}
          </button>
        `).join("")}
      </div>

      ${tab === "overview" ? renderOverview(statCards, adminStats) : ""}
      ${tab === "reports" ? renderReports(adminReports || []) : ""}
      ${tab === "users" ? renderUsers(adminUsers || []) : ""}
    </section>
  `;
}

function renderOverview(statCards, adminStats) {
  if (!adminStats) {
    return `
      <div class="card text-center py-16">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">hourglass_empty</span>
        <p class="text-on-surface-variant text-sm mb-4">Stats not loaded yet.</p>
        <button type="button" class="btn-primary text-sm" data-action="admin-refresh">Load Stats</button>
      </div>`;
  }
  return `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      ${statCards.map((card) => `
        <div class="card gap-2 rounded-2xl">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined ${card.color}" style="font-size:22px;">${card.icon}</span>
            <span class="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">${card.label}</span>
          </div>
          <span class="text-3xl font-bold text-on-surface">${card.value ?? "—"}</span>
        </div>
      `).join("")}
    </div>
    <div class="card rounded-2xl gap-3">
      <h3 class="font-semibold text-on-surface text-sm flex items-center gap-2">
        <span class="material-symbols-outlined text-primary" style="font-size:18px;">insights</span>
        Trade Health
      </h3>
      ${adminStats.totalTrades > 0 ? `
        <div class="space-y-2">
          <div class="flex justify-between text-xs text-on-surface-variant mb-1">
            <span>Completion Rate</span>
            <span class="font-semibold text-emerald-400">${Math.round((adminStats.completedTrades / adminStats.totalTrades) * 100)}%</span>
          </div>
          <div class="h-2 bg-surface-muted rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500 rounded-full transition-all" style="width:${Math.round((adminStats.completedTrades / adminStats.totalTrades) * 100)}%"></div>
          </div>
        </div>
      ` : `<p class="text-xs text-on-surface-variant">No trade data yet.</p>`}
    </div>
  `;
}

function renderReports(reports) {
  if (!reports.length) {
    return `
      <div class="card text-center py-16 rounded-2xl">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">flag</span>
        <p class="text-on-surface-variant text-sm">No reports yet.</p>
        <button type="button" class="btn-primary text-sm mt-4" data-action="admin-refresh">Load Reports</button>
      </div>`;
  }
  return `
    <div class="card rounded-2xl gap-0 p-0 overflow-hidden">
      <div class="flex items-center gap-2 px-5 py-4 border-b border-outline-variant/20">
        <span class="material-symbols-outlined text-red-400" style="font-size:18px;">flag</span>
        <h3 class="font-semibold text-on-surface text-sm">Reports (${reports.length})</h3>
      </div>
      <div class="divide-y divide-outline-variant/10">
        ${reports.map((r) => `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${r.type === "user" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}">${escapeHtml(r.type)}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${r.status === "open" ? "bg-red-500/15 text-red-400" : r.status === "resolved" ? "bg-emerald-500/15 text-emerald-400" : "bg-outline-variant/30 text-on-surface-variant"}">${escapeHtml(r.status)}</span>
                <span class="text-xs text-on-surface-variant">${formatRelativeTime(r.createdAt)}</span>
              </div>
              <p class="text-xs text-on-surface truncate">
                <span class="text-on-surface-variant">By:</span> ${escapeHtml(r.reporterId || "—")}
                &nbsp;→&nbsp;
                <span class="text-on-surface-variant">Target:</span> ${escapeHtml(r.targetId || "—")}
              </p>
              ${r.reason ? `<p class="text-xs text-on-surface-variant mt-1 line-clamp-2">"${escapeHtml(r.reason)}"</p>` : ""}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              ${r.status === "open" ? `
                <button type="button" class="btn-secondary text-xs h-8 px-3" data-action="admin-resolve-report" data-id="${escapeHtml(r.id)}">Resolve</button>
                <button type="button" class="h-8 px-3 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors" data-action="admin-dismiss-report" data-id="${escapeHtml(r.id)}">Dismiss</button>
              ` : `<span class="text-xs text-on-surface-variant">${escapeHtml(r.status)}</span>`}
              ${r.type === "user" && r.status === "open" ? `
                <button type="button" class="h-8 px-3 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors" data-action="admin-ban-user" data-id="${escapeHtml(r.targetId)}">Ban User</button>
              ` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderUsers(users) {
  if (!users.length) {
    return `
      <div class="card text-center py-16 rounded-2xl">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">group</span>
        <p class="text-on-surface-variant text-sm">No users loaded.</p>
        <button type="button" class="btn-primary text-sm mt-4" data-action="admin-refresh">Load Users</button>
      </div>`;
  }
  return `
    <div class="card rounded-2xl gap-0 p-0 overflow-hidden">
      <div class="flex items-center gap-2 px-5 py-4 border-b border-outline-variant/20">
        <span class="material-symbols-outlined text-primary" style="font-size:18px;">group</span>
        <h3 class="font-semibold text-on-surface text-sm">All Users (${users.length})</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-outline-variant/20">
              <th class="text-left px-5 py-3 text-on-surface-variant font-semibold uppercase tracking-wider">User</th>
              <th class="text-left px-5 py-3 text-on-surface-variant font-semibold uppercase tracking-wider">Type</th>
              <th class="text-left px-5 py-3 text-on-surface-variant font-semibold uppercase tracking-wider">Credits</th>
              <th class="text-left px-5 py-3 text-on-surface-variant font-semibold uppercase tracking-wider">Joined</th>
              <th class="text-left px-5 py-3 text-on-surface-variant font-semibold uppercase tracking-wider">Status</th>
              <th class="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/10">
            ${users.map((u) => `
              <tr class="hover:bg-surface-muted/40 transition-colors">
                <td class="px-5 py-3">
                  <div>
                    <p class="font-semibold text-on-surface">${escapeHtml(u.name || "—")}</p>
                    <p class="text-on-surface-variant">${escapeHtml(u.email || "—")}</p>
                  </div>
                </td>
                <td class="px-5 py-3 text-on-surface-variant">${escapeHtml(u.userType || "—")}</td>
                <td class="px-5 py-3 font-semibold text-primary">${u.credits ?? 0}</td>
                <td class="px-5 py-3 text-on-surface-variant">${formatRelativeTime(u.createdAt)}</td>
                <td class="px-5 py-3">
                  ${u.banned
                    ? `<span class="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold text-[10px] uppercase">Banned</span>`
                    : `<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[10px] uppercase">Active</span>`}
                </td>
                <td class="px-5 py-3 text-right">
                  ${!u.banned ? `
                    <button type="button" class="h-7 px-2.5 rounded-lg border border-red-500/30 text-red-400 text-[10px] font-semibold hover:bg-red-500/10 transition-colors" data-action="admin-ban-user" data-id="${escapeHtml(u.uid || u.id)}">Ban</button>
                  ` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
