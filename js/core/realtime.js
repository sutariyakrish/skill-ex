import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "../firebase/config.js";
import { COLLECTIONS } from "../firebase/db.js";
import { setState, state, updateState } from "./state.js";
import { makeChatId } from "../utils/helpers.js";

const listeners = new Map();
const marketplaceCache = {
  listings: [],
  skills: [],
  books: []
};
const cacheStore = new Map();
const CACHE_TTL_MS = {
  marketplace: 45000,
  users: 60000,
  requirements: 45000,
  conversations: 20000,
  creditTransactions: 45000
};
const listenerStats = {
  registered: 0,
  preventedDuplicate: 0
};
const readStatsByRoute = new Map();
const IS_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const paginationState = {
  marketplace: {
    lastDoc: null,
    hasMore: false
  },
  trades: {
    lastDoc: null,
    hasMore: false
  }
};
const messagesCache = new Map();
let activeMessageChatId = null;
let activeContext = {
  route: null,
  uid: null
};

function mapSnapshot(snapshot) {
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

function stopListener(key) {
  const unsubscribe = listeners.get(key);
  if (unsubscribe) {
    unsubscribe();
    listeners.delete(key);
  }
}

function registerListener(key, factory) {
  if (listeners.has(key)) {
    listenerStats.preventedDuplicate += 1;
    if (IS_DEV) {
      console.debug(`[realtime] duplicate listener blocked: ${key}`);
    }
    return;
  }

  listeners.set(key, factory());
  listenerStats.registered += 1;
  if (IS_DEV) {
    console.debug(`[realtime] listener+ ${key}. active=${listeners.size}`);
  }
}

function replaceListener(key, factory) {
  stopListener(key);
  listeners.set(key, factory());
  if (IS_DEV) {
    console.debug(`[realtime] listener~ ${key}. active=${listeners.size}`);
  }
}

function stopAllListeners() {
  for (const key of [...listeners.keys()]) {
    stopListener(key);
  }
  if (IS_DEV) {
    console.debug(`[realtime] listener reset. active=${listeners.size}`);
  }
}

function getCached(key) {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.cachedAt > entry.ttlMs) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data, ttlMs) {
  cacheStore.set(key, {
    data,
    cachedAt: Date.now(),
    ttlMs
  });
}

function trackReads(source, count = 0) {
  const route = activeContext.route || "unknown";
  const current = readStatsByRoute.get(route) || 0;
  const next = current + Number(count || 0);
  readStatsByRoute.set(route, next);
  if (IS_DEV) {
    console.debug(`[realtime] reads route=${route} source=${source} +${count} total=${next}`);
  }
}

async function getCachedOrFetch(key, ttlMs, fetcher) {
  const cached = getCached(key);
  if (cached) {
    if (IS_DEV) {
      console.debug(`[realtime] cache hit: ${key}`);
    }
    return cached;
  }
  const data = await fetcher();
  setCached(key, data, ttlMs);
  if (IS_DEV) {
    console.debug(`[realtime] cache miss/fetch: ${key}`);
  }
  return data;
}

async function fetchUsersOnce() {
  const users = await getCachedOrFetch(
    "users",
    CACHE_TTL_MS.users,
    async () => {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.users), orderBy("createdAt", "desc"), limit(20))
      );
      trackReads("users:getDocs", snapshot.docs.length);
      return mapSnapshot(snapshot);
    }
  );
  const currentUser = users.find((entry) => (entry.uid || entry.id) === state.user?.uid);
  setState(
    {
      users,
      ...(currentUser && state.user
        ? {
            user: {
              ...state.user,
              ...currentUser
            }
          }
        : {})
    },
    { scope: "data" }
  );
}

async function fetchMarketplaceOnce() {
  const data = await getCachedOrFetch(
    "marketplace",
    CACHE_TTL_MS.marketplace,
    async () => {
      const [listingsSnap, legacySkillsSnap, legacyBooksSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.listings), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(db, "skills"), orderBy("time", "desc"), limit(20))),
        getDocs(query(collection(db, "books"), orderBy("time", "desc"), limit(20)))
      ]);
      trackReads("marketplace:getDocs", listingsSnap.docs.length + legacySkillsSnap.docs.length + legacyBooksSnap.docs.length);
      return {
        listings: listingsSnap.docs.map(mapMarketplaceListing),
        skills: legacySkillsSnap.docs.map(mapLegacySkill),
        books: legacyBooksSnap.docs.map(mapLegacyBook),
        listingsLastDoc: listingsSnap.docs[listingsSnap.docs.length - 1] || null,
        listingsHasMore: listingsSnap.docs.length === 20
      };
    }
  );
  marketplaceCache.listings = data.listings;
  marketplaceCache.skills = data.skills;
  marketplaceCache.books = data.books;
  paginationState.marketplace.lastDoc = data.listingsLastDoc;
  paginationState.marketplace.hasMore = Boolean(data.listingsHasMore);
  setState(
    {
      ui: {
        ...state.ui,
        pagination: {
          ...state.ui.pagination,
          marketplaceHasMore: paginationState.marketplace.hasMore,
          marketplaceLoadingMore: false
        }
      }
    },
    { scope: "data" }
  );
  publishMarketplace();
}

async function fetchRequirementsOnce() {
  const uid = state.user?.uid;
  if (!uid) {
    return;
  }
  const requirements = await getCachedOrFetch(
    `requirements:${uid}`,
    CACHE_TTL_MS.requirements,
    async () => {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.requirements), orderBy("createdAt", "desc"), limit(20))
      );
      trackReads("requirements:getDocs", snapshot.docs.length);
      return mapSnapshot(snapshot).filter((entry) => entry.uid === uid);
    }
  );
  setState({ requirements }, { scope: "data" });
}

async function fetchConversationsOnce() {
  const uid = state.user?.uid;
  if (!uid) {
    return;
  }
  const conversations = await getCachedOrFetch(
    `conversations:${uid}`,
    CACHE_TTL_MS.conversations,
    async () => {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.chats), where("participants", "array-contains", uid), limit(20))
      );
      trackReads("conversations:getDocs", snapshot.docs.length);
      return mapSnapshot(snapshot).sort(
        (left, right) => (right.lastMessageAt || right.lastTime || 0) - (left.lastMessageAt || left.lastTime || 0)
      );
    }
  );
  setState({ conversations }, { scope: "data" });
}

async function fetchCreditTransactionsOnce() {
  const uid = state.user?.uid;
  if (!uid) {
    return;
  }
  const creditTransactions = await getCachedOrFetch(
    `creditTransactions:${uid}`,
    CACHE_TTL_MS.creditTransactions,
    async () => {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.creditTransactions), where("uid", "==", uid), limit(20))
      );
      trackReads("credits:getDocs", snapshot.docs.length);
      return mapSnapshot(snapshot).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  );
  setState({ creditTransactions }, { scope: "data" });
}

function publishMarketplace() {
  setState(
    {
      marketplace: [
        ...marketplaceCache.listings,
        ...marketplaceCache.skills,
        ...marketplaceCache.books
      ].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))
    },
    { scope: "data" }
  );
}

function mapMarketplaceListing(entry) {
  return {
    id: entry.id,
    rawId: entry.id,
    sourceCollection: COLLECTIONS.listings,
    ...entry.data()
  };
}

function mapLegacySkill(entry) {
  const data = entry.data();
  return {
    id: `legacy-skill-${entry.id}`,
    rawId: entry.id,
    sourceCollection: "skills",
    uid: data.uid,
    name: data.name,
    email: data.email || "",
    languages: data.languages || [],
    title: data.sName || "Skill",
    description: data.desc || "",
    category: data.cat || "General",
    listingType: "skill",
    priceLabel: data.wants || "",
    tags: [data.cat].filter(Boolean),
    createdAt: data.time || data.createdAt || 0,
    color: data.color,
    bg: data.bg
  };
}

function mapLegacyBook(entry) {
  const data = entry.data();
  return {
    id: `legacy-book-${entry.id}`,
    rawId: entry.id,
    sourceCollection: "books",
    uid: data.uid,
    name: data.name,
    email: data.email || "",
    languages: data.languages || [],
    title: data.title || "Book",
    description: data.desc || (data.wants ? `Looking for: ${data.wants}` : ""),
    category: data.cat || "Books",
    listingType: "book",
    priceLabel: data.wants || "",
    tags: [data.cat].filter(Boolean),
    createdAt: data.time || data.createdAt || 0,
    color: data.color,
    bg: data.bg
  };
}

export function startRealtime() {
  if (!state.user?.uid) return;
  const uid = state.user.uid;
  fetchUsersOnce().catch(console.error);
  fetchCreditTransactionsOnce().catch(console.error);

  // Real-time notifications listener — always active while logged in
  registerListener("notifications:realtime", () =>
    onSnapshot(
      query(
        collection(db, COLLECTIONS.notifications),
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(30)
      ),
      (snapshot) => {
        trackReads("notifications:onSnapshot", snapshot.docs.length);
        const notifs = mapSnapshot(snapshot);
        // Merge with existing to preserve local-only unread flags
        updateState((draft) => {
          // Build map of existing
          const existing = new Map((draft.ui.firestoreNotifications || []).map((n) => [n.id, n]));
          for (const n of notifs) {
            existing.set(n.id, {
              ...n,
              text: n.message || n.text || "",
              unread: !n.read
            });
          }
          draft.ui.firestoreNotifications = [...existing.values()].sort(
            (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
          );
        }, { scope: "full" });
      },
      (error) => {
        if (IS_DEV) console.warn("[realtime] notifications listener error:", error.message);
      }
    )
  );

  setRealtimeRoute(state.route || "dashboard");
}

export function setRealtimeRoute(route = "dashboard") {
  const uid = state.user?.uid || null;
  if (activeContext.route === route && activeContext.uid === uid) {
    return;
  }
  activeContext = { route, uid };
  stopAllListeners();

  if (!uid) {
    return;
  }

  fetchUsersOnce().catch(console.error);

  if (["dashboard", "marketplace", "create-listing"].includes(route)) {
    fetchMarketplaceOnce().catch(console.error);
  } else {
    marketplaceCache.listings = [];
    marketplaceCache.skills = [];
    marketplaceCache.books = [];
    publishMarketplace();
    paginationState.marketplace.lastDoc = null;
    paginationState.marketplace.hasMore = false;
  }

  if (route === "marketplace") {
    fetchRequirementsOnce().catch(console.error);
  } else {
    setState({ requirements: [] }, { scope: "data" });
  }

  if (route === "messages") {
    fetchConversationsOnce().catch(console.error);
    registerListener("conversations:realtime", () =>
      onSnapshot(
        query(collection(db, COLLECTIONS.chats), where("participants", "array-contains", uid), limit(20)),
        (snapshot) => {
          trackReads("conversations:onSnapshot", snapshot.docs.length);
          const conversations = mapSnapshot(snapshot).sort(
            (left, right) => (right.lastMessageAt || right.lastTime || 0) - (left.lastMessageAt || left.lastTime || 0)
          );
          setCached(`conversations:${uid}`, conversations, CACHE_TTL_MS.conversations);
          setState({ conversations }, { scope: "data" });
        }
      )
    );
  } else {
    setState({ conversations: [] }, { scope: "data" });
  }

  if (["dashboard", "trades"].includes(route)) {
    registerListener("trades:realtime", () =>
      onSnapshot(
        query(collection(db, COLLECTIONS.trades), where("participants", "array-contains", uid), limit(20)),
        (snapshot) => {
          trackReads("trades:onSnapshot", snapshot.docs.length);
          const latest = mapSnapshot(snapshot)
            .sort((left, right) => (right.updatedAt || right.createdAt || 0) - (left.updatedAt || left.createdAt || 0));
          const mergedMap = new Map((state.trades || []).map((entry) => [entry.id, entry]));
          for (const row of latest) {
            mergedMap.set(row.id, row);
          }
          const trades = [...mergedMap.values()].sort(
            (left, right) => (right.updatedAt || right.createdAt || 0) - (left.updatedAt || left.createdAt || 0)
          );
          paginationState.trades.lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
          paginationState.trades.hasMore = snapshot.docs.length === 20;
          setState(
            {
              ui: {
                ...state.ui,
                pagination: {
                  ...state.ui.pagination,
                  tradesHasMore: paginationState.trades.hasMore,
                  tradesLoadingMore: false
                }
              }
            },
            { scope: "data" }
          );
          setState({ trades }, { scope: "data" });
        }
      )
    );
  } else {
    setState({ trades: [] }, { scope: "data" });
    paginationState.trades.lastDoc = null;
    paginationState.trades.hasMore = false;
  }
}

export function watchActiveChat(partnerId) {
  if (!state.user?.uid || !partnerId) {
    return null;
  }

  const chatId = makeChatId(state.user.uid, partnerId);
  const cachedMessages = messagesCache.get(chatId);
  setState(
    {
      activeChatId: chatId,
      activeChatUserId: partnerId,
      ...(cachedMessages
        ? {
            messages: {
              ...state.messages,
              [chatId]: cachedMessages
            }
          }
        : {})
    },
    { scope: "data" }
  );

  if (activeMessageChatId === chatId && listeners.has("messages")) {
    return chatId;
  }
  activeMessageChatId = chatId;

  replaceListener("messages", () =>
    onSnapshot(
      query(collection(db, COLLECTIONS.chats, chatId, "messages"), limit(50)),
      (snapshot) => {
        trackReads("messages:onSnapshot", snapshot.docs.length);
        updateState(
          (draft) => {
            const rows = mapSnapshot(snapshot).sort(
              (left, right) => (left.timestamp || left.createdAt || left.time || 0) - (right.timestamp || right.createdAt || right.time || 0)
            );
            messagesCache.set(chatId, rows);
            draft.messages[chatId] = rows;
          },
          { scope: "messages" }
        );
      }
    )
  );

  return chatId;
}

export function clearActiveChat() {
  stopListener("messages");
  activeMessageChatId = null;
  setState(
    {
      activeChatId: null,
      activeChatUserId: null
    },
    { scope: "data" }
  );
}

export function stopRealtime() {
  stopAllListeners();
  listeners.clear();
  cacheStore.clear();
  messagesCache.clear();
  activeContext = { route: null, uid: null };
  activeMessageChatId = null;
  if (IS_DEV) {
    console.debug(`[realtime] stopped. registered=${listenerStats.registered} dupBlocked=${listenerStats.preventedDuplicate}`);
  }
  marketplaceCache.listings = [];
  marketplaceCache.skills = [];
  marketplaceCache.books = [];
  updateState(
    (draft) => {
      draft.users = [];
      draft.marketplace = [];
      draft.conversations = [];
      draft.messages = {};
      draft.meetings = [];
      draft.trades = [];
      draft.requirements = [];
      draft.creditTransactions = [];
      draft.activeChatId = null;
      draft.activeChatUserId = null;
    },
    { scope: "data" }
  );
}

export function invalidateCache(target = "") {
  const entries = [...cacheStore.keys()];
  for (const key of entries) {
    if (key === target || key.startsWith(`${target}:`)) {
      cacheStore.delete(key);
    }
  }
}

export async function loadMoreMarketplace() {
  if (!paginationState.marketplace.hasMore || !paginationState.marketplace.lastDoc) {
    return;
  }
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.listings),
      orderBy("createdAt", "desc"),
      startAfter(paginationState.marketplace.lastDoc),
      limit(20)
    )
  );
  trackReads("marketplace:loadMore", snapshot.docs.length);
  const rows = snapshot.docs.map(mapMarketplaceListing);
  marketplaceCache.listings = [...marketplaceCache.listings, ...rows];
  paginationState.marketplace.lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  paginationState.marketplace.hasMore = snapshot.docs.length === 20;
  invalidateCache("marketplace");
  setState(
    {
      ui: {
        ...state.ui,
        pagination: {
          ...state.ui.pagination,
          marketplaceHasMore: paginationState.marketplace.hasMore,
          marketplaceLoadingMore: false
        }
      }
    },
    { scope: "data" }
  );
  publishMarketplace();
}

export async function loadMoreTrades() {
  if (!state.user?.uid || !paginationState.trades.hasMore || !paginationState.trades.lastDoc) {
    return;
  }
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.trades),
      where("participants", "array-contains", state.user.uid),
      startAfter(paginationState.trades.lastDoc),
      limit(20)
    )
  );
  trackReads("trades:loadMore", snapshot.docs.length);
  const rows = mapSnapshot(snapshot);
  const deduped = new Map((state.trades || []).map((entry) => [entry.id, entry]));
  for (const row of rows) {
    deduped.set(row.id, row);
  }
  const merged = [...deduped.values()].sort((left, right) => (right.updatedAt || right.createdAt || 0) - (left.updatedAt || left.createdAt || 0));
  paginationState.trades.lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  paginationState.trades.hasMore = snapshot.docs.length === 20;
  invalidateCache("trades");
  setState(
    {
      trades: merged,
      ui: {
        ...state.ui,
        pagination: {
          ...state.ui.pagination,
          tradesHasMore: paginationState.trades.hasMore,
          tradesLoadingMore: false
        }
      }
    },
    { scope: "data" }
  );
}
