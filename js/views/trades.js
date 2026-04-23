import { escapeHtml, formatDateTime, formatRelativeTime, renderAvatar } from "../utils/helpers.js";

function findUser(users, id) {
  return users.find((u) => (u.uid || u.id) === id) || null;
}

function renderEscrowBadge(trade) {
  if (trade.tradeType !== "credit") return "";
  const amount = Number(trade.escrowCredits || trade.creditAmount) || 0;
  if (amount <= 0) return "";

  if (trade.status === "requested") {
    return `<span class="badge bg-transparent border border-outline-variant/50 text-xs">
      <span class="material-symbols-outlined text-[13px] text-amber-400">lock</span>
      ${amount} CRD pending
    </span>`;
  }
  if (trade.status === "accepted" && trade.creditsTransferred && !trade.escrowReleased && !trade.escrowRefunded) {
    return `<span class="badge bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
      <span class="material-symbols-outlined text-[13px]">lock</span>
      ${amount} CRD in escrow
    </span>`;
  }
  if (trade.escrowReleased) {
    return `<span class="badge bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
      <span class="material-symbols-outlined text-[13px]">lock_open</span>
      ${amount} CRD released
    </span>`;
  }
  if (trade.escrowRefunded) {
    return `<span class="badge bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400">
      <span class="material-symbols-outlined text-[13px]">undo</span>
      ${amount} CRD refunded
    </span>`;
  }
  return `<span class="badge bg-transparent border border-outline-variant/50 text-xs">${amount} CRD</span>`;
}

function renderTradeCard(state, trade) {
  const isSeller = trade.sellerId === state.user.uid;
  const isBuyer = trade.buyerId === state.user.uid;
  const partnerId = isSeller ? trade.buyerId : trade.sellerId;
  const partner = findUser(state.users, partnerId) || { name: "Unknown user" };
  const status = trade.status || "requested";
  const isBarter = trade.tradeType === "barter";
  const completedByBuyer = Boolean(trade.completedByBuyer);
  const completedBySeller = Boolean(trade.completedBySeller);
  const hasMarkedComplete =
    (isBuyer && completedByBuyer) || (isSeller && completedBySeller);
  const isWaitingForOtherOnBarter =
    isBarter &&
    status === "accepted" &&
    ((isBuyer && completedByBuyer && !completedBySeller) ||
      (isSeller && completedBySeller && !completedByBuyer));

  // Only buyer can review seller
  const needsMyReview =
    status === "completed" && isBuyer && !(trade.reviewsBy || {})[state.user.uid];
  const reviewTargetId = trade.sellerId;
  const ratingInputId = `trade-rating-${trade.id}`;
  const reviewInputId = `trade-review-${trade.id}`;

  const statusClass = {
    requested: "status-requested",
    accepted:  "status-accepted",
    completed: "status-completed",
    cancelled: "status-cancelled",
    rejected:  "status-rejected"
  }[status] || "badge";

  const statusIcon = {
    requested: "schedule",
    accepted:  "handshake",
    completed: "task_alt",
    cancelled: "cancel",
    rejected:  "block"
  }[status] || "info";

  // Determine what role label to show
  const myRole = isSeller ? "Seller" : "Buyer";
  const myRoleColor = isSeller ? "text-primary" : "text-on-surface-variant";

  return `
    <article class="card flex flex-col gap-0 transition-all hover:border-outline p-0 overflow-hidden">
      <!-- Header strip -->
      <div class="px-5 py-4 flex justify-between items-start gap-4 border-b border-outline-variant/40"
           style="background: var(--surface-muted);">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
               style="background: var(--surface-soft, var(--surface-variant)); color: var(--accent);">
            ${renderAvatar(partner, "w-full h-full flex items-center justify-center")}
          </div>
          <div class="flex flex-col min-w-0">
            <strong class="text-sm font-semibold text-primary line-clamp-1">
              ${escapeHtml(trade.listingTitle || "Trade request")}
            </strong>
            <span class="text-xs text-on-surface-variant">
              ${escapeHtml(partner.name)} ·
              <span class="${myRoleColor} font-medium">You: ${myRole}</span> ·
              ${escapeHtml(trade.tradeType || "credit")}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="material-symbols-outlined text-[14px]" style="color: var(--on-surface-variant);">${statusIcon}</span>
          <span class="${statusClass} shrink-0 text-xs">${escapeHtml(status)}</span>
        </div>
      </div>

      <!-- Body -->
      <div class="px-5 py-4 flex flex-col gap-3">
        <!-- Meta badges -->
        <div class="flex flex-wrap gap-2">
          ${renderEscrowBadge(trade)}
          <span class="badge bg-transparent border border-outline-variant/50 text-xs">
            <span class="material-symbols-outlined text-[13px]">schedule</span>
            ${escapeHtml(formatRelativeTime(trade.createdAt))}
          </span>
          ${isBarter ? `
            <span class="badge bg-transparent border border-outline-variant/50 text-xs">
              Buyer ✓: ${completedByBuyer ? "Yes" : "No"}
            </span>
            <span class="badge bg-transparent border border-outline-variant/50 text-xs">
              Seller ✓: ${completedBySeller ? "Yes" : "No"}
            </span>` : ""}
          ${trade.listingType ? `
            <span class="badge bg-transparent border border-outline-variant/50 text-xs capitalize">
              ${escapeHtml(trade.listingType)}
            </span>` : ""}
        </div>

        ${isWaitingForOtherOnBarter ? `
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <span class="material-symbols-outlined text-[15px]">hourglass_top</span>
            Waiting for the other party to confirm completion.
          </div>` : ""}

        <!-- Action buttons -->
        <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-outline-variant/30">
          ${status === "requested" && isSeller
            ? `<button class="btn-secondary h-8 px-3 text-xs" data-action="trade-accept" data-id="${trade.id}">
                <span class="material-symbols-outlined text-[15px]">check</span> Accept
               </button>
               <button class="btn-danger h-8 px-3 text-xs" data-action="trade-reject" data-id="${trade.id}">
                <span class="material-symbols-outlined text-[15px]">close</span> Reject
               </button>`
            : ""}
          ${(status === "requested" || status === "accepted")
            ? `<button class="btn-secondary h-8 px-3 text-xs text-on-surface-variant hover:text-danger"
                        data-action="trade-cancel" data-id="${trade.id}">
                 <span class="material-symbols-outlined text-[15px]">cancel</span> Cancel
               </button>`
            : ""}
          ${status === "accepted" && (isBarter || isSeller) && !hasMarkedComplete
            ? `<button class="btn-primary h-8 px-3 text-xs" data-action="trade-complete" data-id="${trade.id}">
                 <span class="material-symbols-outlined text-[15px]">task_alt</span> Mark Complete
               </button>`
            : ""}
          <button class="btn-secondary h-8 px-3 text-xs ml-auto" data-action="open-trade-chat"
                  data-trade-id="${trade.id}" data-user-id="${partnerId}">
            <span class="material-symbols-outlined text-[15px]">chat</span> Chat
          </button>
        </div>

        <!-- Review form -->
        ${needsMyReview ? `
          <div class="flex flex-col gap-3 mt-1 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[18px]">star</span>
              <h4 class="text-sm font-bold text-primary">Leave a Review for ${escapeHtml(partner.name)}</h4>
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="flex flex-col gap-1 w-full sm:w-1/4">
                <label class="text-xs font-bold text-on-surface-variant ml-1" for="${ratingInputId}">Rating</label>
                <select class="input cursor-pointer h-9 text-sm" id="${ratingInputId}">
                  <option value="5">⭐⭐⭐⭐⭐ (5)</option>
                  <option value="4">⭐⭐⭐⭐ (4)</option>
                  <option value="3">⭐⭐⭐ (3)</option>
                  <option value="2">⭐⭐ (2)</option>
                  <option value="1">⭐ (1)</option>
                </select>
              </div>
              <div class="flex flex-col gap-1 flex-1">
                <label class="text-xs font-bold text-on-surface-variant ml-1" for="${reviewInputId}">Feedback (optional)</label>
                <input class="input h-9 text-sm" id="${reviewInputId}" placeholder="Great communication and delivery…">
              </div>
            </div>
            <button
              class="btn-primary h-9 px-4 text-sm"
              data-action="rate-trade"
              data-id="${trade.id}"
              data-target-user-id="${reviewTargetId}"
              data-rating-input="${ratingInputId}"
              data-review-input="${reviewInputId}"
            >
              Submit Review
            </button>
          </div>` : ""}
      </div>
    </article>`;
}

export function renderTradesView(state) {
  const mine = state.trades || [];
  const active = mine.filter((t) => !["completed", "cancelled", "rejected"].includes(t.status));
  const closed = mine.filter((t) => ["completed", "cancelled", "rejected"].includes(t.status));

  return `
    <section class="page-section animate-fade-in">
      <div class="card flex-row items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-0.5">Trade Workflow</p>
          <h2 class="font-headline-md font-bold text-lg text-primary">Your Trades</h2>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge-brand">${mine.length} total</span>
          ${active.length > 0 ? `<span class="badge bg-amber-500/10 border border-amber-500/30 text-amber-400">${active.length} active</span>` : ""}
        </div>
      </div>

      <!-- Active Trades -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-base text-primary">Active Trades</h3>
          <span class="badge">${active.length}</span>
        </div>
        ${active.length
          ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${active.map((t) => renderTradeCard(state, t)).join("")}</div>`
          : `<div class="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-outline-variant border-dashed" style="background: var(--surface-muted);">
               <span class="material-symbols-outlined text-on-surface-variant mb-2 opacity-40" style="font-size:36px;">sync_alt</span>
               <p class="text-sm font-semibold text-primary">No active trades</p>
               <p class="text-xs text-on-surface-variant mt-1">Offer a trade from marketplace listings.</p>
             </div>`}
        ${state.ui.pagination?.tradesHasMore ? `
          <div class="mt-4 flex justify-center">
            <button type="button" class="btn-secondary h-9 px-4" data-action="load-more-trades"
              ${state.ui.pagination?.tradesLoadingMore ? "disabled" : ""}>
              ${state.ui.pagination?.tradesLoadingMore ? "Loading…" : "Load More"}
            </button>
          </div>` : ""}
      </div>

      <!-- Completed & Closed -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-base text-primary">Completed &amp; Closed</h3>
          <span class="badge">${closed.length}</span>
        </div>
        ${closed.length
          ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${closed.map((t) => renderTradeCard(state, t)).join("")}</div>`
          : `<div class="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-outline-variant border-dashed" style="background: var(--surface-muted);">
               <span class="material-symbols-outlined text-on-surface-variant mb-2 opacity-40" style="font-size:36px;">history</span>
               <p class="text-sm font-semibold text-primary">No completed trades yet</p>
               <p class="text-xs text-on-surface-variant mt-1">Your finished trades will appear here.</p>
             </div>`}
      </div>
    </section>`;
}
