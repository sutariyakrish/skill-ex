import {
  escapeHtml,
  formatRelativeTime,
  formatDateTime,
  getConversationPartnerId,
  renderAvatar
} from "../utils/helpers.js";

function findUser(users, uid) {
  return users.find((u) => u.uid === uid || u.id === uid) || null;
}

function formatMessageTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isSameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function renderMessagesView(state) {
  const search = state.ui.messageSearch.trim().toLowerCase();
  const conversations = state.conversations.filter((conversation) => {
    const partnerId = getConversationPartnerId(conversation, state.user.uid);
    const partner = findUser(state.users, partnerId);
    return !search || `${partner?.name || ""} ${conversation.lastMessage || ""}`.toLowerCase().includes(search);
  });

  const activePartner = findUser(state.users, state.activeChatUserId);
  const activeMessages = state.activeChatId ? state.messages[state.activeChatId] || [] : [];

  // Group messages by date for date separators
  function getDateKey(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function renderDateSeparator(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const label = isToday
      ? "Today"
      : d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    return `
      <div class="flex items-center gap-3 my-2 select-none">
        <div class="flex-1 h-px bg-outline-variant/40"></div>
        <span class="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide px-2">${label}</span>
        <div class="flex-1 h-px bg-outline-variant/40"></div>
      </div>`;
  }

  let lastDateKey = "";
  const messageHtml = activeMessages.map((msg) => {
    const isMe = (msg.from || msg.senderId) === state.user.uid;
    const ts = msg.timestamp || msg.createdAt || msg.time || 0;
    const dateKey = getDateKey(ts);
    const separator = dateKey && dateKey !== lastDateKey ? renderDateSeparator(ts) : "";
    lastDateKey = dateKey;

    const seen = msg.seenBy && Array.isArray(msg.seenBy) ? msg.seenBy : [];
    const isSeenByPartner = isMe && state.activeChatUserId && seen.includes(state.activeChatUserId);

    return `${separator}
      <article class="flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%] ${isMe ? "self-end" : "self-start"}">
        <div class="px-4 py-2.5 rounded-2xl ${
          isMe
            ? "bg-primary text-on-primary rounded-tr-sm"
            : "bg-surface-variant text-on-surface rounded-tl-sm border border-outline-variant/30"
        } shadow-sm">
          ${msg.tradeId ? `<span class="text-[10px] font-bold opacity-70 uppercase tracking-widest block mb-1">Trade #${escapeHtml(String(msg.tradeId).slice(0, 6))}</span>` : ""}
          <p class="text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap">${escapeHtml(msg.text || "")}</p>
        </div>
        <div class="flex items-center gap-1 mt-0.5 ${isMe ? "flex-row-reverse" : ""}">
          <span class="text-[10px] text-on-surface-variant">${formatMessageTime(ts)}</span>
          ${isMe ? `
            <span class="material-symbols-outlined text-[12px] ${isSeenByPartner ? "text-primary" : "text-on-surface-variant/50"}" title="${isSeenByPartner ? "Seen" : "Sent"}">
              ${isSeenByPartner ? "done_all" : "done"}
            </span>` : ""}
        </div>
      </article>`;
  }).join("");

  return `
    <section class="flex flex-col lg:flex-row gap-4 p-4 md:p-6 max-w-7xl mx-auto h-[calc(100vh-100px)]">

      <!-- Sidebar / Inbox -->
      <aside class="w-full lg:w-[320px] flex flex-col gap-4 shrink-0">
        <div class="card p-4">
          <div class="flex flex-col gap-1 mb-3">
            <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Inbox</span>
            <h2 class="text-xl font-bold text-primary">Conversations</h2>
          </div>
          <input
            class="input mt-1"
            name="messageSearch"
            data-model="ui"
            value="${escapeHtml(state.ui.messageSearch)}"
            placeholder="Search conversations…"
          >
        </div>

        <div class="card flex-1 p-0 overflow-hidden flex flex-col">
          ${conversations.length ? `
            <div class="overflow-y-auto flex-1">
              ${conversations.map((conversation) => {
                const partnerId = getConversationPartnerId(conversation, state.user.uid);
                const partner = findUser(state.users, partnerId) || { name: "Unknown user", uid: partnerId };
                const isActive = state.activeChatUserId === partnerId;
                const hasUnread = conversation.unreadCount > 0 && !isActive;

                return `
                  <button class="w-full flex items-start gap-3 p-4 text-left transition-colors border-b border-outline-variant/20 hover:bg-surface-variant
                    ${isActive ? "bg-surface-variant border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent"}
                    ${hasUnread ? "bg-primary/5" : ""}"
                    data-action="select-conversation"
                    data-user-id="${partnerId}"
                  >
                    <div class="relative shrink-0">
                      <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-surface-variant bg-surface-variant flex items-center justify-center font-bold text-primary">
                        ${renderAvatar(partner, "w-full h-full flex items-center justify-center")}
                      </div>
                      ${hasUnread ? `<span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-surface"></span>` : ""}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex justify-between items-baseline mb-0.5">
                        <strong class="text-sm font-bold text-primary truncate">${escapeHtml(partner.name)}</strong>
                        <span class="text-[10px] text-on-surface-variant whitespace-nowrap ml-2">
                          ${formatRelativeTime(conversation.lastMessageAt || conversation.lastTime)}
                        </span>
                      </div>
                      <div class="flex items-center gap-2">
                        ${conversation.tradeId ? `<span class="badge-primary px-1.5 py-0 text-[10px]">Trade</span>` : ""}
                        <span class="text-xs text-on-surface-variant truncate ${hasUnread ? "font-semibold text-on-surface" : ""}">
                          ${escapeHtml(conversation.lastMessage || conversation.lastMsg || "Open conversation")}
                        </span>
                      </div>
                    </div>
                  </button>`;
              }).join("")}
            </div>
          ` : `
            <div class="flex flex-col items-center justify-center h-full p-8 text-center bg-surface-variant/50 m-4 rounded-xl border border-outline-variant/30 border-dashed">
              <span class="material-symbols-outlined text-on-surface-variant mb-2 opacity-50" style="font-size:36px;">forum</span>
              <strong class="text-primary mb-1">No conversations yet</strong>
              <span class="text-sm text-on-surface-variant">Message sellers from the marketplace to start chatting.</span>
            </div>
          `}
        </div>
      </aside>

      <!-- Main Chat Area -->
      <section class="flex-1 flex flex-col min-w-0">
        <div class="card flex-1 p-0 overflow-hidden flex flex-col h-full">
          ${activePartner ? `
            <header class="p-4 border-b border-outline-variant/30 bg-surface flex justify-between items-center z-10 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-surface-variant shrink-0 bg-surface-variant flex items-center justify-center font-bold text-primary">
                  ${renderAvatar(activePartner, "w-full h-full flex items-center justify-center")}
                </div>
                <div class="flex flex-col">
                  <strong class="text-base font-bold text-primary">${escapeHtml(activePartner.name)}</strong>
                  <span class="text-xs text-on-surface-variant flex items-center gap-1">
                    ${activePartner.headline
                      ? escapeHtml(activePartner.headline)
                      : escapeHtml((activePartner.languages || []).join(", ") || "No languages listed")}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn-secondary h-8 px-3 text-xs" data-action="open-chat" data-user-id="${state.activeChatUserId}" title="New chat">
                  <span class="material-symbols-outlined text-[15px]">chat</span>
                </button>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-2 bg-background/50" data-chat-scroll>
              ${activeMessages.length
                ? messageHtml
                : `
                <div class="m-auto flex flex-col items-center justify-center p-8 text-center bg-surface-variant/50 rounded-xl border border-outline-variant/30 border-dashed">
                  <span class="material-symbols-outlined text-on-surface-variant mb-2" style="font-size:36px;">chat_bubble_outline</span>
                  <strong class="text-primary mb-1">Start the conversation</strong>
                  <span class="text-sm text-on-surface-variant">Send a message and it will appear here in real time.</span>
                </div>`}
            </div>

            <form class="p-4 border-t border-outline-variant/30 bg-surface flex items-end gap-2" data-form="message">
              <input
                class="input flex-1 m-0 h-[44px]"
                id="message-input"
                name="messageDraft"
                data-model="ui"
                value="${escapeHtml(state.ui.messageDraft)}"
                placeholder="Write a message…"
                autocomplete="off"
              >
              <button class="btn-primary h-[44px] px-4" type="submit" ${state.loading.message ? "disabled" : ""}>
                <span class="material-symbols-outlined text-[20px]">${state.loading.message ? "hourglass_empty" : "send"}</span>
              </button>
            </form>
          ` : `
            <div class="m-auto flex flex-col items-center justify-center p-8 text-center text-on-surface-variant">
              <span class="material-symbols-outlined opacity-30 mb-4" style="font-size:48px;">forum</span>
              <strong class="text-primary mb-1">Select a conversation</strong>
              <span class="text-sm">Choose an existing thread or message a seller from the marketplace.</span>
            </div>
          `}
        </div>
      </section>
    </section>
  `;
}
