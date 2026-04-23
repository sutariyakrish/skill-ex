function readStoredTheme() {
  try {
    return localStorage.getItem("skillex-theme") || "dark";
  } catch {
    return "dark";
  }
}

function createDefaultState() {
  return {
    route: "dashboard",
    authResolved: false,
    user: null,
    users: [],
    marketplace: [],
    conversations: [],
    messages: {},
    meetings: [],
    trades: [],
    requirements: [],
    creditTransactions: [],
    activeChatId: null,
    activeChatUserId: null,
    ui: {
      theme: readStoredTheme(),
      sidebarOpen: false,
      authMode: "login",
      authError: "",
      authNotice: "",
      authForm: {
        step: 1,
        name: "",
        email: "",
        password: "",
        userType: "",
        institution: "",
        locationMode: "auto",
        location: {
          country: "",
          state: "",
          city: "",
          pincode: ""
        },
        languages: [],
        languageSearch: "",
        showLoginPassword: false,
        showSignupPassword: false
      },
      listingForm: {
        title: "",
        description: "",
        listingType: "skill",
        creditPrice: ""
      },
      marketplaceFilters: {
        search: "",
        locationType: "all",
        languages: [],
        languageSearch: "",
        listingType: "all",
        sortBy: "newest"
      },
      marketplaceFiltersOpen: false,
      requirementForm: {
        text: "",
        listingType: "skill"
      },
      messageSearch: "",
      messageDraft: "",
      activeTradeId: null,
      tradeRating: 5,
      reviewForm: {
        tradeId: "",
        targetUserId: "",
        rating: "5",
        reviewText: ""
      },
      meetingForm: {
        participantId: "",
        topic: "",
        scheduledAt: "",
        link: ""
      },
      profileForm: {
        name: "",
        email: "",
        languages: [],
        headline: "",
        bio: ""
      },
      pagination: {
        marketplaceHasMore: false,
        marketplaceLoadingMore: false,
        tradesHasMore: false,
        tradesLoadingMore: false
      },
      notifications: [],
      firestoreNotifications: [],
      recentCreditChange: 0
    },
    loading: {
      auth: false,
      location: false,
      listing: false,
      message: false,
      meeting: false,
      profile: false
    }
  };
}

export const state = createDefaultState();
const listeners = new Set();

function notify(meta = {}) {
  for (const listener of listeners) {
    listener(state, meta);
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(patch, meta = {}) {
  Object.assign(state, patch);
  if (!meta.silent) {
    notify(meta);
  }
}

export function updateState(recipe, meta = {}) {
  recipe(state);
  if (!meta.silent) {
    notify(meta);
  }
}

export function resetStateForLogout() {
  const next = createDefaultState();
  next.ui.theme = state.ui.theme;
  Object.assign(state, next);
  notify({ scope: "full" });
}
