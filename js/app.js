import {
  checkSignupEmailVerified,
  finalizeVerifiedSignup,
  getAuthErrorMessage,
  login,
  logout,
  observeAuth,
  resendSignupEmailVerification,
  sendPasswordReset,
  startSignupEmailVerification,
  syncAuthEmail
} from "./firebase/auth.js";
import {
  claimOneTimeCredits,
  createRequirement,
  createMarketplaceListing,
  createTradeRequest,
  createUserProfile,
  getUserProfile,
  removeRequirement,
  removeListing,
  reportListing,
  reportUser,
  blockUser,
  sendChatMessage,
  submitTradeReview,
  updateRequirement,
  updateTradeStatus,
  upsertConversation,
  updateUserProfile
} from "./firebase/db.js";
import { initRouter, navigate } from "./core/router.js";
import {
  clearActiveChat,
  invalidateCache,
  loadMoreMarketplace,
  loadMoreTrades,
  setRealtimeRoute,
  startRealtime,
  stopRealtime,
  watchActiveChat
} from "./core/realtime.js";
import { resetStateForLogout, setState, state, subscribe, updateState } from "./core/state.js";
import { renderAppShell } from "./ui/navbar.js";
import { initModalHost, openModal } from "./ui/modal.js";
import { initToastHost, showToast } from "./ui/toast.js";
import { renderAuthView } from "./views/authView.js";
import { renderDashboardView } from "./views/dashboard.js";
import { renderMarketplaceView } from "./views/marketplace.js";
import { renderCreateListingView } from "./views/createListing.js";
import { renderMessagesView } from "./views/messages.js";
import { renderTradesView } from "./views/trades.js";
import { renderProfileView } from "./views/profile.js";
import { renderAdminView } from "./views/adminView.js";
import {
  adminGetStats,
  adminGetReports,
  adminGetUsers,
  adminUpdateReportStatus,
  adminBanUser as adminBanUserDb
} from "./firebase/db.js";
import {
  createInitials,
  formatDateTime,
  getConversationPartnerId,
  pickPalette,
  ROUTE_TITLES,
  unique
} from "./utils/helpers.js";
import {
  validateListingForm,
  validateLoginForm,
  validateProfileForm,
  validateSignupStep
} from "./utils/validators.js";
import { getPasswordStrength } from "./utils/validators.js";
import { getPricingRules } from "./utils/progression.js";

const appRoot = document.getElementById("app");
let signupResendTicker = null;
const inputDebounceTimers = new Map();
const seenConversationTimes = new Map();
const NOTIFICATION_STORAGE_KEY = "skillex-notifications";
const viewRenderers = {
  dashboard: renderDashboardView,
  marketplace: renderMarketplaceView,
  "create-listing": renderCreateListingView,
  trades: renderTradesView,
  messages: renderMessagesView,
  profile: renderProfileView,
  admin: (s) => renderAdminView(s)
};

const SIGNUP_FLOW = [1, 2, 3, 4, 5, 6];

function getVisibleSignupSteps(form = state.ui.authForm) {
  return SIGNUP_FLOW.filter((step) => step !== 4 || form.userType === "Student");
}

function getSignupStepIndex(form = state.ui.authForm) {
  return Math.max(0, getVisibleSignupSteps(form).indexOf(form.step));
}

function isSignupFinalStep(form = state.ui.authForm) {
  const steps = getVisibleSignupSteps(form);
  return steps[steps.length - 1] === form.step;
}

function getNextSignupStep(form = state.ui.authForm) {
  const steps = getVisibleSignupSteps(form);
  const index = steps.indexOf(form.step);
  return steps[Math.min(index + 1, steps.length - 1)];
}

function getPreviousSignupStep(form = state.ui.authForm) {
  const steps = getVisibleSignupSteps(form);
  const index = steps.indexOf(form.step);
  return steps[Math.max(index - 1, 0)];
}

function setNestedValue(target, path, value) {
  const parts = path.split(".");
  let cursor = target;

  while (parts.length > 1) {
    const part = parts.shift();
    if (!cursor[part] || typeof cursor[part] !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }

  cursor[parts[0]] = value;
}

function createEmptyAuthForm() {
  return {
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
    showSignupPassword: false,
    emailVerified: false,
    verificationSentAt: 0,
    resendAttempts: 0,
    resendAvailableAt: 0
  };
}

function getResendCooldownMs(attempt) {
  if (attempt <= 0) {
    return 60 * 1000;
  }
  return 5 * 60 * 1000 * attempt;
}

function updateAuthResendTimerNode() {
  const timerNode = document.querySelector("[data-auth-resend-timer]");
  if (!timerNode) {
    return;
  }
  const endAt = Number(timerNode.getAttribute("data-end-at")) || 0;
  const remainingMs = Math.max(0, endAt - Date.now());
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  timerNode.textContent = `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function debounceByKey(key, callback, wait = 300) {
  const existing = inputDebounceTimers.get(key);
  if (existing) {
    window.clearTimeout(existing);
  }
  const handle = window.setTimeout(() => {
    inputDebounceTimers.delete(key);
    callback();
  }, wait);
  inputDebounceTimers.set(key, handle);
}

function updatePasswordStrengthUI(password = "") {
  const strength = getPasswordStrength(password);
  const bars = document.querySelectorAll("[data-password-strength-bar]");
  bars.forEach((bar, index) => {
    const active = strength.score > index;
    bar.classList.toggle("bg-primary", active);
    bar.classList.toggle("bg-surface-variant", !active);
  });
  const label = document.querySelector("[data-password-strength-label]");
  if (label) {
    const text = strength.score >= 3 ? "STRONG" : strength.score >= 2 ? "MEDIUM" : "WEAK";
    label.textContent = text;
    label.classList.toggle("text-primary", strength.score >= 3);
    label.classList.toggle("text-on-surface-variant", strength.score < 3);
  }
}

function updatePriceFeedbackUI(value) {
  const priceInput = document.getElementById("listing-price");
  if (!priceInput || !state.user) {
    return;
  }
  const pricingRules = getPricingRules(state.user);
  const numericPrice = Number(value);
  const hasNumericPrice = Number.isFinite(numericPrice) && String(value).trim() !== "";
  const nearLimitThreshold = pricingRules.finalCap * 0.85;
  const tone = !hasNumericPrice
    ? "neutral"
    : numericPrice > pricingRules.finalCap
      ? "danger"
      : numericPrice >= nearLimitThreshold
        ? "warning"
        : "success";

  priceInput.classList.remove(
    "border-red-500/70",
    "focus:border-red-500",
    "focus:ring-red-500",
    "border-amber-500/70",
    "focus:border-amber-500",
    "focus:ring-amber-500",
    "border-emerald-500/70",
    "focus:border-emerald-500",
    "focus:ring-emerald-500"
  );
  if (tone === "danger") {
    priceInput.classList.add("border-red-500/70", "focus:border-red-500", "focus:ring-red-500");
  } else if (tone === "warning") {
    priceInput.classList.add("border-amber-500/70", "focus:border-amber-500", "focus:ring-amber-500");
  } else if (tone === "success") {
    priceInput.classList.add("border-emerald-500/70", "focus:border-emerald-500", "focus:ring-emerald-500");
  }

  const metaNode = document.querySelector("[data-price-meta]");
  if (metaNode) {
    metaNode.textContent = `Max: ${pricingRules.finalCap} CRD${hasNumericPrice ? ` · Remaining: ${Math.max(0, pricingRules.finalCap - numericPrice)} CRD` : ""} · Suggested: ${pricingRules.suggestedMin}-${pricingRules.suggestedMax} CRD`;
  }

  const feedbackNode = document.querySelector("[data-price-feedback]");
  if (feedbackNode) {
    feedbackNode.textContent = !hasNumericPrice
      ? ""
      : tone === "danger"
        ? "Red: exceeds max allowed price."
        : tone === "warning"
          ? "Yellow: near your max allowed price."
          : "Green: valid price range.";
    feedbackNode.className = `mt-2 text-xs font-semibold ${tone === "danger" ? "text-red-400" : tone === "warning" ? "text-amber-400" : tone === "success" ? "text-emerald-400" : "text-on-surface-variant"}`;
  }
}

function closeFloatingPanels() {
  document.querySelector("[data-profile-menu]")?.classList.add("hidden");
  document.querySelector("[data-notifications-panel]")?.classList.add("hidden");
  document.querySelector("[data-credit-history-panel]")?.classList.add("hidden");
}

function toggleFloatingPanel(panelSelector) {
  const panel = document.querySelector(panelSelector);
  if (!panel) {
    return;
  }
  const willOpen = panel.classList.contains("hidden");
  closeFloatingPanels();
  if (willOpen) {
    panel.classList.remove("hidden");
  }
}

function loadStoredNotifications() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function persistNotifications(notifications) {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify((notifications || []).slice(0, 20)));
  } catch {}
}

function applyTheme() {
  document.body.classList.toggle("theme-light", state.ui.theme === "light");
  try {
    localStorage.setItem("skillex-theme", state.ui.theme);
  } catch {}
}

function renderLoadingShell() {
  appRoot.innerHTML = `
    <div class="auth-card-wrap">
      <div class="auth-card surface surface--glow text-center">
        <div class="stack items-center">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center mx-auto" style="background: var(--accent);">
            <span class="material-symbols-outlined text-white">bolt</span>
          </div>
          <h1 class="title-lg">SkillEX</h1>
          <p class="text-sm text-on-surface-variant">Loading your workspace...</p>
          <div class="w-8 h-8 border-2 border-outline-variant border-t-primary rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    </div>
  `;
}

function renderView() {
  if (!state.authResolved) {
    renderLoadingShell();
    return;
  }

  if (!state.user) {
    appRoot.innerHTML = renderAuthView(state);
    return;
  }

  const viewRoot = document.getElementById("route-view");
  if (!viewRoot) {
    return;
  }

  const renderer = viewRenderers[state.route] || renderDashboardView;
  viewRoot.innerHTML = renderer(state);
  syncDynamicPageTitle();
  syncChatScroll();
}

function renderShell() {
  applyTheme();

  if (!state.authResolved) {
    renderLoadingShell();
    return;
  }

  if (!state.user) {
    appRoot.innerHTML = renderAuthView(state);
    return;
  }

  // Merge Firestore notifications with local notifications (Firestore takes priority)
  const firestoreNotifs = state.ui.firestoreNotifications || [];
  const localNotifs = state.ui.notifications || [];
  const mergedNotifs = firestoreNotifs.length > 0
    ? firestoreNotifs
    : localNotifs;

  appRoot.innerHTML = renderAppShell({
    route: state.route,
    user: state.user,
    notifications: mergedNotifs,
    creditTransactions: state.creditTransactions || [],
    sidebarOpen: state.ui.sidebarOpen,
    content: '<div id="route-view"></div>'
  });

  setRealtimeRoute(state.route);
  renderView();
}

function syncDynamicPageTitle() {
  document.title = `SkillEx | ${ROUTE_TITLES[state.route] || "App"}`;
}

function syncChatScroll() {
  if (state.route !== "messages") {
    return;
  }

  const stream = document.querySelector("[data-chat-scroll]");
  if (stream) {
    stream.scrollTop = stream.scrollHeight;
  }
}

function rememberFocus() {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return null;
  }

  return {
    id: activeElement.id || "",
    name: activeElement.getAttribute("name") || "",
    selectionStart: typeof activeElement.selectionStart === "number" ? activeElement.selectionStart : null,
    selectionEnd: typeof activeElement.selectionEnd === "number" ? activeElement.selectionEnd : null
  };
}

function restoreFocus(snapshot) {
  if (!snapshot) {
    return;
  }

  const target = snapshot.id ? document.getElementById(snapshot.id) : document.querySelector(`[name="${snapshot.name}"]`);
  if (!target) {
    return;
  }

  target.focus();
  if (typeof snapshot.selectionStart === "number" && typeof target.setSelectionRange === "function") {
    target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd ?? snapshot.selectionStart);
  }
}

function hydrateProfileForm(user) {
  updateState(
    (draft) => {
      draft.ui.profileForm = {
        name: user.name || "",
        email: user.email || "",
        languages: [...(user.languages || [])],
        headline: user.headline || "",
        bio: user.bio || ""
      };
    },
    { silent: true }
  );
}

function resetTransientForms() {
  updateState(
    (draft) => {
      draft.ui.authError = "";
      draft.ui.authNotice = "";
      draft.ui.authForm = createEmptyAuthForm();
      draft.ui.listingForm = {
        title: "",
        description: "",
        listingType: "skill",
        creditPrice: ""
      };
      draft.ui.meetingForm = {
        participantId: "",
        topic: "",
        scheduledAt: "",
        link: ""
      };
      draft.ui.requirementForm = {
        text: "",
        listingType: "skill"
      };
      draft.ui.messageDraft = "";
      draft.ui.messageSearch = "";
      draft.ui.activeTradeId = null;
      draft.ui.notifications = [];
      draft.ui.recentCreditChange = 0;
      draft.loading.auth = false;
      draft.loading.location = false;
    },
    { silent: true }
  );
}

function routeNeedsDataRefresh(route) {
  return ["dashboard", "marketplace", "create-listing", "trades", "messages"].includes(route);
}

function findUser(userId) {
  return state.users.find((entry) => (entry.uid || entry.id) === userId) || null;
}

function toggleLanguage(source, language) {
  updateState(
    (draft) => {
      const target = source === "profile" ? draft.ui.profileForm.languages : draft.ui.authForm.languages;
      const next = target.includes(language) ? target.filter((entry) => entry !== language) : [...target, language];

      if (source === "profile") {
        draft.ui.profileForm.languages = next;
      } else {
        draft.ui.authForm.languages = next;
        if (draft.ui.authForm.languageSearch.toLowerCase() === language.toLowerCase()) {
          draft.ui.authForm.languageSearch = "";
        }
      }
    },
    { scope: "view" }
  );
}

function removeLanguage(source, language) {
  updateState(
    (draft) => {
      if (source === "profile") {
        draft.ui.profileForm.languages = draft.ui.profileForm.languages.filter((entry) => entry !== language);
      } else {
        draft.ui.authForm.languages = draft.ui.authForm.languages.filter((entry) => entry !== language);
      }
    },
    { scope: "view" }
  );
}

function validateFullSignupForm(form) {
  const steps = getVisibleSignupSteps(form);
  for (const step of steps) {
    // step is a number (element of SIGNUP_FLOW)
    const stepId = typeof step === "object" ? step.id : step;
    const error = validateSignupStep(stepId, form);
    if (error) {
      return { error, step: stepId };
    }
  }

  return { error: "", step: steps[steps.length - 1] };
}

function setAuthMessage({ error = "", notice = "" }, scope = "view") {
  updateState(
    (draft) => {
      draft.ui.authError = error;
      draft.ui.authNotice = notice;
    },
    { scope }
  );
}

function setAuthLoading(value) {
  updateState(
    (draft) => {
      draft.loading.auth = value;
    },
    { silent: true }
  );
}

async function handleLogin() {
  const payload = state.ui.authForm;
  const validationError = validateLoginForm(payload);
  setAuthMessage({ error: validationError, notice: "" });

  if (validationError) {
    return;
  }

  setAuthLoading(true);
  renderView();

  try {
    await login(payload.email, payload.password);
  } catch (error) {
    setAuthLoading(false);
    setAuthMessage({ error: getAuthErrorMessage(error), notice: "" });
  }
}

async function handleSignup() {
  const payload = structuredClone(state.ui.authForm);
  const { error, step } = validateFullSignupForm(payload);

  if (error) {
    updateState(
      (draft) => {
        draft.ui.authError = error;
        draft.ui.authNotice = "";
        draft.ui.authForm.step = step;
      },
      { scope: "view" }
    );
    return;
  }

  setAuthLoading(true);
  renderView();

  try {
    await finalizeVerifiedSignup(payload);
  } catch (errorObject) {
    setAuthLoading(false);
    setAuthMessage({ error: getAuthErrorMessage(errorObject), notice: "" });
  }
}

async function handleSignupEmailVerificationStart() {
  const form = state.ui.authForm;
  const error = validateSignupStep(1, form);
  if (error) {
    setAuthMessage({ error, notice: "" });
    return;
  }
  setAuthLoading(true);
  renderView();
  try {
    await startSignupEmailVerification(form.email.trim().toLowerCase(), form.password);
    const now = Date.now();
    updateState(
      (draft) => {
        draft.loading.auth = false;
        draft.ui.authError = "";
        draft.ui.authNotice = "Verification email sent. Open your inbox and click the verification link.";
        draft.ui.authForm.step = 2;
        draft.ui.authForm.emailVerified = false;
        draft.ui.authForm.verificationSentAt = now;
        draft.ui.authForm.resendAttempts = 1;
        draft.ui.authForm.resendAvailableAt = now + getResendCooldownMs(0);
      },
      { scope: "view" }
    );
  } catch (errorObject) {
    setAuthLoading(false);
    setAuthMessage({ error: getAuthErrorMessage(errorObject), notice: "" });
  }
}

async function handleVerifyEmailStatus() {
  try {
    const verified = await checkSignupEmailVerified();
    if (!verified) {
      setAuthMessage({ error: "Email is not verified yet. Please click the link in your inbox.", notice: "" });
      return;
    }
    updateState(
      (draft) => {
        draft.ui.authError = "";
        draft.ui.authNotice = "Email verified successfully.";
        draft.ui.authForm.emailVerified = true;
        draft.ui.authForm.step = 3;
      },
      { scope: "view" }
    );
  } catch (errorObject) {
    setAuthMessage({ error: getAuthErrorMessage(errorObject), notice: "" });
  }
}

async function handleResendVerificationEmail() {
  const now = Date.now();
  if (now < (state.ui.authForm.resendAvailableAt || 0)) {
    return;
  }
  try {
    await resendSignupEmailVerification();
    updateState(
      (draft) => {
        const attempts = Number(draft.ui.authForm.resendAttempts) || 1;
        const nextAttempts = attempts + 1;
        draft.ui.authNotice = "Verification email resent.";
        draft.ui.authError = "";
        draft.ui.authForm.resendAttempts = nextAttempts;
        draft.ui.authForm.resendAvailableAt = Date.now() + getResendCooldownMs(nextAttempts - 1);
      },
      { scope: "view" }
    );
  } catch (errorObject) {
    setAuthMessage({ error: getAuthErrorMessage(errorObject), notice: "" });
  }
}

async function handlePasswordReset() {
  const email = state.ui.authForm.email.trim();
  if (!email) {
    setAuthMessage({ error: "Enter your email first.", notice: "" });
    return;
  }

  try {
    await sendPasswordReset(email);
    setAuthMessage({ error: "", notice: "Password reset email sent." });
  } catch (error) {
    setAuthMessage({ error: getAuthErrorMessage(error), notice: "" });
  }
}

function goToNextSignupStep() {
  const form = state.ui.authForm;
  if (form.step === 1) {
    handleSignupEmailVerificationStart();
    return;
  }
  if (form.step === 2) {
    handleVerifyEmailStatus();
    return;
  }
  const error = validateSignupStep(form.step, form);
  if (error) {
    setAuthMessage({ error, notice: "" });
    return;
  }

  updateState(
    (draft) => {
      draft.ui.authError = "";
      draft.ui.authNotice = "";
      draft.ui.authForm.step = getNextSignupStep(draft.ui.authForm);
    },
    { scope: "view" }
  );
}

function goToPreviousSignupStep() {
  updateState(
    (draft) => {
      draft.ui.authError = "";
      draft.ui.authNotice = "";
      draft.ui.authForm.step = getPreviousSignupStep(draft.ui.authForm);
    },
    { scope: "view" }
  );
}

async function reverseGeocodeCoordinates(latitude, longitude) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Location lookup failed.");
  }

  const data = await response.json();
  return {
    country: data.countryName || "",
    state: data.principalSubdivision || "",
    city: data.city || data.locality || data.localityInfo?.administrative?.[2]?.name || "",
    pincode: data.postcode || ""
  };
}

async function detectLocation() {
  if (!navigator.geolocation) {
    updateState(
      (draft) => {
        draft.ui.authForm.locationMode = "manual";
        draft.ui.authError = "Location is not supported in this browser. Please enter it manually.";
        draft.ui.authNotice = "";
      },
      { scope: "view" }
    );
    return;
  }

  updateState(
    (draft) => {
      draft.loading.location = true;
      draft.ui.authError = "";
      draft.ui.authNotice = "";
      draft.ui.authForm.locationMode = "auto";
    },
    { scope: "view", silent: true }
  );
  renderView();

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const location = await reverseGeocodeCoordinates(position.coords.latitude, position.coords.longitude);

    updateState(
      (draft) => {
        draft.loading.location = false;
        draft.ui.authForm.location = location;
        draft.ui.authError = "";
        draft.ui.authNotice = "Location detected successfully.";
      },
      { scope: "view" }
    );
  } catch (error) {
    updateState(
      (draft) => {
        draft.loading.location = false;
        draft.ui.authForm.locationMode = "manual";
        draft.ui.authError = "Location permission was denied or unavailable. Please enter it manually.";
        draft.ui.authNotice = "";
      },
      { scope: "view" }
    );
  }
}

async function handleListingSubmit() {
  const payload = {
    ...state.ui.listingForm,
    title: String(state.ui.listingForm.title || "").trim(),
    description: String(state.ui.listingForm.description || "").trim()
  };
  const error = validateListingForm(payload);
  if (error) {
    showToast({ title: "Listing blocked", description: error, tone: "danger" });
    return;
  }

  updateState(
    (draft) => {
      draft.loading.listing = true;
    },
    { silent: true }
  );
  renderView();

  try {
    const result = await createMarketplaceListing(state.user.uid, {
      name: state.user.name,
      email: state.user.email,
      languages: state.user.languages || [],
      accentColor: state.user.accentColor,
      accentSurface: state.user.accentSurface,
      title: payload.title,
      description: payload.description,
      listingType: payload.listingType,
      creditPrice: payload.creditPrice
    });

    updateState(
      (draft) => {
        draft.loading.listing = false;
        draft.ui.listingForm = {
          title: "",
          description: "",
          listingType: "skill",
          creditPrice: ""
        };
        if (draft.user) {
          draft.user.level = result.level;
          draft.user.tradesCompleted = result.pricing.tradesCompleted;
          draft.user.rating = result.pricing.rating;
          draft.user.totalListingsCreated = result.totalListingsCreated;
        }
        if (result.rewardAwarded && draft.user) {
          draft.user.credits = result.credits;
          draft.user.firstListingRewardGiven = true;
          draft.ui.recentCreditChange = 40;
        } else {
          draft.ui.recentCreditChange = 0;
        }
      },
      { scope: "view" }
    );
    invalidateCache("marketplace");

    showToast({ title: "Listing published", description: "Your marketplace item is live.", tone: "success" });
    if (result.rewardAwarded) {
      openModal({
        title: "Congratulations!",
        body: "You earned 40 credits for publishing your first listing.",
        confirmLabel: "Awesome",
        confirmTone: "btn--primary",
        icon: "emoji_events"
      });
      window.setTimeout(() => {
        updateState(
          (draft) => {
            if (draft.ui.recentCreditChange === 40) {
              draft.ui.recentCreditChange = 0;
            }
          },
          { scope: "view" }
        );
      }, 4800);
    }
  } catch (error) {
    updateState(
      (draft) => {
        draft.loading.listing = false;
      },
      { scope: "view" }
    );
    showToast({ title: "Publish failed", description: error.message, tone: "danger" });
  }
}

async function handleMessageSubmit() {
  if (!state.activeChatId || !state.activeChatUserId || !state.ui.messageDraft.trim()) {
    return;
  }

  updateState(
    (draft) => {
      draft.loading.message = true;
    },
    { silent: true }
  );
  renderView();

  const partner = findUser(state.activeChatUserId);
  const text = state.ui.messageDraft.trim();

  try {
    await ensureChatForUserPair(state.user.uid, state.activeChatUserId, state.ui.activeTradeId || null);
    await sendChatMessage(state.activeChatId, {
      participants: [state.user.uid, state.activeChatUserId],
      from: state.user.uid,
      fromName: state.user.name,
      to: state.activeChatUserId,
      toName: partner?.name || "Unknown user",
      tradeId: state.ui.activeTradeId || null,
      text
    });

    updateState(
      (draft) => {
        draft.loading.message = false;
        draft.ui.messageDraft = "";
      },
      { scope: "view" }
    );
  } catch (error) {
    updateState(
      (draft) => {
        draft.loading.message = false;
      },
      { scope: "view" }
    );
    showToast({ title: "Message failed", description: error.message, tone: "danger" });
  }
}

async function handleRequirementSubmit() {
  const payload = state.ui.requirementForm;
  if (!payload.text.trim()) {
    showToast({ title: "Requirement blocked", description: "Add a short requirement.", tone: "danger" });
    return;
  }
  try {
    await createRequirement(state.user.uid, {
      text: payload.text.trim(),
      listingType: payload.listingType
    });
    updateState((draft) => {
      draft.ui.requirementForm.text = "";
      draft.requirements = [
        {
          id: `tmp-${Date.now()}`,
          uid: state.user.uid,
          text: payload.text.trim(),
          listingType: payload.listingType,
          createdAt: Date.now()
        },
        ...(draft.requirements || [])
      ].slice(0, 20);
    }, { scope: "view" });
    invalidateCache("requirements");
    showToast({ title: "Requirement added", description: "Saved to Firestore.", tone: "success" });
  } catch (error) {
    showToast({ title: "Save failed", description: error.message, tone: "danger" });
  }
}

function findListingById(listingId) {
  return state.marketplace.find((entry) => entry.id === listingId || entry.rawId === listingId) || null;
}

async function handleOfferTrade(listingId, sellerId, tradeType = "credit") {
  if (!listingId || !sellerId || sellerId === state.user.uid) {
    return;
  }
  const listing = findListingById(listingId);
  try {
    const chatId = [state.user.uid, sellerId].sort().join("_");
    const tradeRef = await createTradeRequest({
      listingId,
      listingTitle: listing?.title || "Listing",
      listingType: listing?.listingType || "skill",
      sourceCollection: listing?.sourceCollection || "listings",
      sellerId,
      buyerId: state.user.uid,
      participants: [state.user.uid, sellerId],
      chatId,
      tradeType: tradeType === "barter" ? "barter" : "credit",
      creditAmount: tradeType === "barter" ? 0 : Number(listing?.creditPrice) || 0
    });
    await ensureChatForUserPair(state.user.uid, sellerId, tradeRef.id);
    showToast({ title: "Trade request sent", description: "Seller can now accept or reject.", tone: "success" });
  } catch (error) {
    showToast({ title: "Trade failed", description: error.message, tone: "danger" });
  }
}

async function runTradeAction(tradeId, status, options = {}) {
  try {
    const result = await updateTradeStatus(tradeId, status, state.user.uid, options);
    invalidateCache("trades");
    invalidateCache("marketplace");
    if (result?.completed) {
      openModal({
        title: "🎉 Trade completed!",
        body: "Your trade is fully complete. You can now leave a review.",
        confirmLabel: "Awesome",
        confirmTone: "btn--primary"
      });
    } else {
      showToast({ title: "Trade updated", description: `Status changed to ${result?.status || status}.`, tone: "success" });
    }
  } catch (error) {
    showToast({ title: "Action failed", description: error.message, tone: "danger" });
  }
}

async function handleTradeReviewSubmit(tradeId, targetUserId, ratingValue, reviewText) {
  const rating = Number(ratingValue);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    showToast({ title: "Invalid rating", description: "Rating must be between 1 and 5.", tone: "danger" });
    return;
  }
  try {
    await submitTradeReview(tradeId, {
      reviewerId: state.user.uid,
      targetUserId,
      rating,
      reviewText: reviewText || ""
    });
    showToast({ title: "Review submitted", description: "Thanks for rating this trade.", tone: "success" });
  } catch (error) {
    showToast({ title: "Review failed", description: error.message, tone: "danger" });
  }
}

async function handleProfileSubmit() {
  const payload = state.ui.profileForm;
  const error = validateProfileForm(payload);

  if (error) {
    showToast({ title: "Profile blocked", description: error, tone: "danger" });
    return;
  }

  updateState(
    (draft) => {
      draft.loading.profile = true;
    },
    { silent: true }
  );
  renderView();

  try {
    await updateUserProfile(state.user.uid, {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      languages: unique(payload.languages),
      headline: payload.headline.trim(),
      bio: payload.bio.trim(),
      initials: createInitials(payload.name)
    });

    await syncAuthEmail(payload.email.trim().toLowerCase());

    const palette = state.user.accentColor ? { accent: state.user.accentColor, surface: state.user.accentSurface } : pickPalette(state.user.uid);
    const nextUser = {
      ...state.user,
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      languages: unique(payload.languages),
      headline: payload.headline.trim(),
      bio: payload.bio.trim(),
      initials: createInitials(payload.name),
      accentColor: palette.accent,
      accentSurface: palette.surface
    };

    setState({ user: nextUser }, { scope: "full" });
    invalidateCache("users");
    invalidateCache("marketplace");
    updateState(
      (draft) => {
        draft.loading.profile = false;
      },
      { silent: true }
    );
    hydrateProfileForm(nextUser);
    renderView();
    showToast({ title: "Profile saved", description: "Your public profile is updated.", tone: "success" });
  } catch (error) {
    updateState(
      (draft) => {
        draft.loading.profile = false;
      },
      { scope: "view" }
    );
    showToast({ title: "Save failed", description: error.message, tone: "danger" });
  }
}

function openLogoutModal() {
  openModal({
    title: "Sign out of SkillEx?",
    body: "You will keep your data in Firebase, but this browser session will close.",
    confirmLabel: "Sign out",
    confirmTone: "btn--danger",
    onConfirm: async () => {
      await logout();
    }
  });
}

function openSignupBonusModal() {
  openModal({
    title: "Congratulations!",
    body: "🎉 You earned 50 credits! Add your first skill to earn 40 more.",
    confirmLabel: "Awesome",
    confirmTone: "btn--primary",
    icon: "verified"
  });
}

function openCreditHistoryModal() {
  const rows = (state.creditTransactions || []).slice(0, 60);
  const body = rows.length
    ? rows
        .map((entry) => {
          const sign = Number(entry.amount) >= 0 ? "+" : "";
          return `${sign}${entry.amount} credits · ${entry.reason || "update"} · ${formatDateTime(entry.createdAt)}`;
        })
        .join("<br>")
    : "No credit transactions yet.";
  openModal({
    title: "Credit transaction history",
    body,
    confirmLabel: "Close",
    cancelLabel: "Close",
    confirmTone: "btn--primary"
  });
}

async function ensureChatForUserPair(userA, userB, tradeId = null) {
  await upsertConversation([userA, userB].sort().join("_"), {
    participants: [userA, userB],
    ...(tradeId ? { tradeId } : {})
  });
}

function deleteListingWithConfirm(id, sourceCollection = "listings") {
  openModal({
    title: "Delete listing?",
    body: "This removes the listing from the realtime marketplace for everyone.",
    confirmLabel: "Delete",
    confirmTone: "btn--danger",
    onConfirm: async () => {
      await removeListing(id, sourceCollection);
      updateState((draft) => {
        draft.marketplace = (draft.marketplace || []).filter((entry) => (entry.rawId || entry.id) !== id);
      }, { scope: "data" });
      invalidateCache("marketplace");
      showToast({ title: "Listing deleted", description: "The listing has been removed.", tone: "success" });
    }
  });
}

function updateModelValue(model, name, value) {
  updateState(
    (draft) => {
      if (model === "ui") {
        draft.ui[name] = value;
        return;
      }

      setNestedValue(draft.ui[model], name, value);
      if (model === "authForm") {
        draft.ui.authError = "";
        draft.ui.authNotice = "";
      }
    },
    { silent: true }
  );
}

function handleBoundInput(event) {
  const field = event.target.closest("[data-model]");
  if (!field || !field.name) {
    return;
  }

  const snapshot = rememberFocus();
  let value = field.value;
  if (field.dataset.model === "marketplaceFilters" && field.name === "languages" && field.tagName === "SELECT" && field.multiple) {
    value = [...field.selectedOptions].map((option) => option.value);
  }
  updateModelValue(field.dataset.model, field.name, value);

  if (field.dataset.model === "authForm" && field.name === "password") {
    updatePasswordStrengthUI(field.value);
    return;
  }
  if (field.dataset.model === "listingForm" && field.name === "creditPrice") {
    updatePriceFeedbackUI(field.value);
    return;
  }

  if (
    field.dataset.model === "marketplaceFilters" ||
    (field.dataset.model === "ui" && field.name === "messageSearch") ||
    (field.dataset.model === "authForm" && field.name === "languageSearch")
  ) {
    debounceByKey(`${field.dataset.model}:${field.name}`, () => {
      renderView();
      restoreFocus(snapshot);
    }, 300);
    return;
  }

  if (
    field.dataset.model === "authForm" && field.name === "userType"
  ) {
    renderView();
    restoreFocus(snapshot);
  }
}

async function resolveUserProfile(firebaseUser) {
  let profile = await getUserProfile(firebaseUser.uid);

  if (!profile && state.loading.auth) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    profile = await getUserProfile(firebaseUser.uid);
  }

  if (!profile) {
    const palette = pickPalette(firebaseUser.uid);
    const pendingForm = state.loading.auth && state.ui.authMode === "signup" ? structuredClone(state.ui.authForm) : null;
    const pendingName = pendingForm?.name?.trim() || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "SkillEx User";

    profile = {
      uid: firebaseUser.uid,
      name: pendingName,
      email: pendingForm?.email?.trim().toLowerCase() || firebaseUser.email || "",
      userType: pendingForm?.userType || "General User",
      institution: pendingForm?.userType === "Student" ? pendingForm.institution.trim() : "",
      location: pendingForm?.location || {
        country: "",
        state: "",
        city: "",
        pincode: ""
      },
      languages: pendingForm?.languages || [],
      headline: "Open to learning and collaboration",
      bio: "",
      initials: createInitials(pendingName),
      accentColor: palette.accent,
      accentSurface: palette.surface,
      credits: 0,
      signupBonusGiven: false,
      firstListingRewardGiven: false,
      createdAt: Date.now()
    };
    await createUserProfile(firebaseUser.uid, profile);
  }

  return profile;
}

document.addEventListener("click", async (event) => {
  const clickInsideProfile = event.target.closest("[data-action='toggle-profile-menu'], [data-profile-menu]");
  const clickInsideNotifications = event.target.closest("[data-action='toggle-notifications'], [data-notifications-panel]");
  const clickInsideCreditHistory = event.target.closest("[data-action='toggle-credit-history'], [data-credit-history-panel]");
  if (!clickInsideProfile) {
    document.querySelector("[data-profile-menu]")?.classList.add("hidden");
  }
  if (!clickInsideNotifications) {
    document.querySelector("[data-notifications-panel]")?.classList.add("hidden");
  }
  if (!clickInsideCreditHistory) {
    document.querySelector("[data-credit-history-panel]")?.classList.add("hidden");
  }

  const button = event.target.closest("[data-action], [data-route]");
  if (!button) {
    return;
  }

  if (button.dataset.route) {
    closeFloatingPanels();
    navigate(button.dataset.route);
    updateState(
      (draft) => {
        draft.ui.sidebarOpen = false;
      },
      { silent: true }
    );
    return;
  }

  const { action } = button.dataset;

  if (action === "toggle-profile-menu") {
    event.preventDefault();
    toggleFloatingPanel("[data-profile-menu]");
    return;
  }

  if (action === "toggle-credit-history") {
    event.preventDefault();
    toggleFloatingPanel("[data-credit-history-panel]");
    return;
  }

  if (action === "toggle-notifications") {
    event.preventDefault();
    // Mark Firestore notifications as read locally
    updateState((draft) => {
      draft.ui.notifications = (draft.ui.notifications || []).map((n) => ({ ...n, unread: false }));
      draft.ui.firestoreNotifications = (draft.ui.firestoreNotifications || []).map((n) => ({ ...n, unread: false }));
      persistNotifications(draft.ui.notifications);
    }, { scope: "full" });
    toggleFloatingPanel("[data-notifications-panel]");
    return;
  }

  if (action === "mark-all-notifications-read") {
    updateState((draft) => {
      draft.ui.notifications = (draft.ui.notifications || []).map((entry) => ({ ...entry, unread: false }));
      persistNotifications(draft.ui.notifications);
    }, { scope: "full" });
    return;
  }

  if (action === "switch-auth-mode") {
    updateState(
      (draft) => {
        const nextMode = draft.ui.authMode === "login" ? "signup" : "login";
        const nextForm = createEmptyAuthForm();
        nextForm.email = draft.ui.authForm.email;
        draft.ui.authMode = nextMode;
        draft.ui.authError = "";
        draft.ui.authNotice = "";
        draft.ui.authForm = nextForm;
        draft.loading.auth = false;
        draft.loading.location = false;
      },
      { scope: "view" }
    );
    return;
  }

  if (action === "reset-password") {
    await handlePasswordReset();
    return;
  }

  if (action === "toggle-language") {
    toggleLanguage(button.dataset.source, button.dataset.value);
    return;
  }

  if (action === "add-language") {
    toggleLanguage("auth", button.dataset.value);
    return;
  }

  if (action === "remove-language") {
    removeLanguage("auth", button.dataset.value);
    return;
  }

  if (action === "toggle-login-password") {
    updateState(
      (draft) => {
        draft.ui.authForm.showLoginPassword = !draft.ui.authForm.showLoginPassword;
      },
      { scope: "view" }
    );
    return;
  }

  if (action === "toggle-signup-password") {
    updateState(
      (draft) => {
        draft.ui.authForm.showSignupPassword = !draft.ui.authForm.showSignupPassword;
      },
      { scope: "view" }
    );
    return;
  }

  if (action === "set-user-type") {
    event.preventDefault();
    const selectedType = button.dataset.value;
    updateState(
      (draft) => {
        draft.ui.authForm.userType = selectedType;
        if (selectedType !== "Student") {
          draft.ui.authForm.institution = "";
        }
        draft.ui.authError = "";
        draft.ui.authNotice = "";
      },
      { scope: "view" }
    );
    // Auto-advance to next step after short delay so user sees the selection
    window.setTimeout(() => goToNextSignupStep(), 220);
    return;
  }

  if (action === "set-location-mode") {
    event.preventDefault();
    updateState(
      (draft) => {
        draft.ui.authForm.locationMode = button.dataset.value;
        draft.ui.authError = "";
        draft.ui.authNotice = "";
      },
      { scope: "view" }
    );
    return;
  }

  if (action === "detect-location") {
    await detectLocation();
    return;
  }

  if (action === "signup-next") {
    goToNextSignupStep();
    return;
  }

  if (action === "signup-check-email") {
    await handleVerifyEmailStatus();
    return;
  }

  if (action === "signup-resend-email") {
    await handleResendVerificationEmail();
    return;
  }

  if (action === "signup-back") {
    goToPreviousSignupStep();
    return;
  }

  if (action === "toggle-theme") {
    updateState(
      (draft) => {
        draft.ui.theme = draft.ui.theme === "dark" ? "light" : "dark";
      },
      { scope: "full" }
    );
    return;
  }

  if (action === "toggle-sidebar") {
    updateState(
      (draft) => {
        draft.ui.sidebarOpen = !draft.ui.sidebarOpen;
      },
      { scope: "full" }
    );
    return;
  }

  if (action === "close-sidebar") {
    updateState(
      (draft) => {
        draft.ui.sidebarOpen = false;
      },
      { scope: "full" }
    );
    return;
  }

  if (action === "logout") {
    openLogoutModal();
    return;
  }

  if (action === "open-credit-history") {
    openCreditHistoryModal();
    return;
  }

  if (action === "open-chat") {
    const targetUserId = button.dataset.userId;
    if (targetUserId) {
      await ensureChatForUserPair(state.user.uid, targetUserId);
      watchActiveChat(targetUserId);
      navigate("messages");
    }
    return;
  }

  if (action === "select-conversation") {
    const targetUserId = button.dataset.userId;
    if (targetUserId) {
      await ensureChatForUserPair(state.user.uid, targetUserId);
      watchActiveChat(targetUserId);
      renderView();
    }
    return;
  }

  if (action === "delete-listing") {
    deleteListingWithConfirm(button.dataset.id, button.dataset.source || "listings");
    return;
  }

  if (action === "offer-trade") {
    await handleOfferTrade(button.dataset.listingId, button.dataset.userId, button.dataset.tradeType || "credit");
    return;
  }

  if (action === "trade-accept") {
    await runTradeAction(button.dataset.id, "accepted");
    return;
  }

  if (action === "trade-reject") {
    await runTradeAction(button.dataset.id, "rejected");
    return;
  }

  if (action === "trade-cancel") {
    await runTradeAction(button.dataset.id, "cancelled");
    return;
  }

  if (action === "trade-complete") {
    await runTradeAction(button.dataset.id, "completed");
    return;
  }

  if (action === "rate-trade") {
    const ratingInput = document.getElementById(button.dataset.ratingInput || "");
    const reviewInput = document.getElementById(button.dataset.reviewInput || "");
    await handleTradeReviewSubmit(
      button.dataset.id,
      button.dataset.targetUserId,
      ratingInput?.value || "5",
      reviewInput?.value || ""
    );
    return;
  }

  if (action === "open-trade-chat") {
    const partnerId = button.dataset.userId;
    const tradeId = button.dataset.tradeId;
    if (partnerId) {
      await ensureChatForUserPair(state.user.uid, partnerId, tradeId);
      watchActiveChat(partnerId);
      updateState((draft) => {
        draft.ui.activeTradeId = tradeId || null;
      }, { silent: true });
      navigate("messages");
    }
    return;
  }

  if (action === "delete-requirement") {
    const requirementId = button.dataset.id;
    if (!requirementId) {
      return;
    }
    try {
      await removeRequirement(requirementId);
      updateState((draft) => {
        draft.requirements = (draft.requirements || []).filter((entry) => entry.id !== requirementId);
      }, { scope: "view" });
      invalidateCache("requirements");
      showToast({ title: "Requirement deleted", description: "Removed from your list.", tone: "success" });
    } catch (error) {
      showToast({ title: "Delete failed", description: error.message, tone: "danger" });
    }
    return;
  }

  if (action === "edit-requirement") {
    const requirementId = button.dataset.id;
    const existing = state.requirements.find((entry) => entry.id === requirementId);
    if (!requirementId || !existing) {
      return;
    }
    const nextText = window.prompt("Edit your requirement:", existing.text || "");
    if (nextText === null) {
      return;
    }
    const trimmed = nextText.trim();
    if (!trimmed) {
      showToast({ title: "Requirement blocked", description: "Requirement text cannot be empty.", tone: "danger" });
      return;
    }
    try {
      await updateRequirement(requirementId, { text: trimmed });
      updateState((draft) => {
        draft.requirements = (draft.requirements || []).map((entry) =>
          entry.id === requirementId ? { ...entry, text: trimmed, updatedAt: Date.now() } : entry
        );
      }, { scope: "view" });
      invalidateCache("requirements");
      showToast({ title: "Requirement updated", description: "Saved changes.", tone: "success" });
    } catch (error) {
      showToast({ title: "Update failed", description: error.message, tone: "danger" });
    }
  }

  if (action === "clear-filter") {
    const filterName = button.dataset.filter;
    if (!filterName) {
      return;
    }
    updateState((draft) => {
      draft.ui.marketplaceFilters[filterName] = filterName === "languages" ? [] : "all";
    }, { scope: "view" });
    return;
  }

  if (action === "clear-all-filters") {
    updateState((draft) => {
      draft.ui.marketplaceFilters = {
        search: "",
        locationType: "all",
        languages: [],
        languageSearch: "",
        listingType: "all",
        sortBy: "newest"
      };
    }, { scope: "view" });
    return;
  }

  if (action === "toggle-marketplace-filters") {
    updateState((draft) => {
      draft.ui.marketplaceFiltersOpen = !draft.ui.marketplaceFiltersOpen;
    }, { scope: "view" });
    return;
  }

  if (action === "set-marketplace-filter") {
    const filterKey = button.dataset.filter;
    const value = button.dataset.value || "all";
    if (filterKey) {
      updateState((draft) => {
        if (filterKey === "sortBy") {
          draft.ui.marketplaceFilters[filterKey] = value;
        } else {
          draft.ui.marketplaceFilters[filterKey] =
            draft.ui.marketplaceFilters[filterKey] === value ? "all" : value;
        }
      }, { scope: "view" });
    }
    return;
  }

  if (action === "add-marketplace-language") {
    const value = button.dataset.value;
    if (!value) {
      return;
    }
    updateState((draft) => {
      if (!draft.ui.marketplaceFilters.languages.includes(value)) {
        draft.ui.marketplaceFilters.languages = [...draft.ui.marketplaceFilters.languages, value];
      }
      draft.ui.marketplaceFilters.languageSearch = "";
    }, { scope: "view" });
    return;
  }

  if (action === "remove-marketplace-language") {
    const value = button.dataset.value;
    if (!value) {
      return;
    }
    updateState((draft) => {
      draft.ui.marketplaceFilters.languages = draft.ui.marketplaceFilters.languages.filter((entry) => entry !== value);
    }, { scope: "view" });
    return;
  }

  if (action === "remove-filter-chip") {
    const filterName = button.dataset.filter;
    const value = button.dataset.value;
    if (!filterName) {
      return;
    }
    updateState((draft) => {
      if (filterName === "languages") {
        draft.ui.marketplaceFilters.languages = draft.ui.marketplaceFilters.languages.filter((entry) => entry !== value);
      } else {
        draft.ui.marketplaceFilters[filterName] = "all";
      }
    }, { scope: "view" });
    return;
  }

  if (action === "load-more-marketplace") {
    updateState((draft) => {
      draft.ui.pagination.marketplaceLoadingMore = true;
    }, { scope: "view" });
    try {
      await loadMoreMarketplace();
    } catch (error) {
      updateState((draft) => {
        draft.ui.pagination.marketplaceLoadingMore = false;
      }, { scope: "view" });
      showToast({ title: "Load failed", description: error.message, tone: "danger" });
    }
    return;
  }

  if (action === "load-more-trades") {
    updateState((draft) => {
      draft.ui.pagination.tradesLoadingMore = true;
    }, { scope: "view" });
    try {
      await loadMoreTrades();
    } catch (error) {
      updateState((draft) => {
        draft.ui.pagination.tradesLoadingMore = false;
      }, { scope: "view" });
      showToast({ title: "Load failed", description: error.message, tone: "danger" });
    }
    return;
  }

  if (action === "report-listing") {
    const listingId = button.dataset.id;
    if (!listingId) return;
    const reason = window.prompt("Reason for reporting this listing (optional):", "") ?? "";
    if (reason === null) return;
    try {
      await reportListing(state.user.uid, listingId, reason);
      showToast({ title: "Reported", description: "The listing has been reported for review.", tone: "success" });
    } catch (error) {
      showToast({ title: "Report failed", description: error.message, tone: "danger" });
    }
    return;
  }

  if (action === "report-user") {
    const targetId = button.dataset.userId;
    if (!targetId) return;
    const reason = window.prompt("Reason for reporting this user (optional):", "") ?? "";
    if (reason === null) return;
    try {
      await reportUser(state.user.uid, targetId, reason);
      showToast({ title: "Reported", description: "The user has been reported for review.", tone: "success" });
    } catch (error) {
      showToast({ title: "Report failed", description: error.message, tone: "danger" });
    }
    return;
  }

  if (action === "block-user") {
    const targetId = button.dataset.userId;
    if (!targetId) return;
    openModal({
      title: "Block this user?",
      body: "They won't be able to message you or appear in your marketplace. You can unblock from your profile.",
      confirmLabel: "Block",
      confirmTone: "btn--danger",
      icon: "block",
      onConfirm: async () => {
        try {
          await blockUser(state.user.uid, targetId);
          updateState((draft) => {
            draft.user.blockedUsers = [...new Set([...(draft.user.blockedUsers || []), targetId])];
          }, { scope: "full" });
          showToast({ title: "User blocked", description: "They've been removed from your view.", tone: "success" });
        } catch (error) {
          showToast({ title: "Block failed", description: error.message, tone: "danger" });
        }
      }
    });
    return;
  }

  if (action === "admin-tab") {
    const tab = button.dataset.tab;
    if (!tab) return;
    setState({ admin: { ...state.admin, adminTab: tab } }, { scope: "view" });
    return;
  }

  if (action === "admin-refresh") {
    try {
      const [stats, reports, users] = await Promise.all([adminGetStats(), adminGetReports(), adminGetUsers()]);
      setState({ admin: { ...(state.admin || {}), adminStats: stats, adminReports: reports, adminUsers: users } }, { scope: "view" });
      showToast({ title: "Refreshed", description: "Admin data reloaded.", tone: "success" });
    } catch (e) {
      showToast({ title: "Refresh failed", description: e.message, tone: "danger" });
    }
    return;
  }

  if (action === "admin-resolve-report") {
    const reportId = button.dataset.id;
    if (!reportId) return;
    try {
      await adminUpdateReportStatus(reportId, "resolved");
      setState({
        admin: {
          ...(state.admin || {}),
          adminReports: (state.admin?.adminReports || []).map((r) => r.id === reportId ? { ...r, status: "resolved" } : r)
        }
      }, { scope: "view" });
      showToast({ title: "Resolved", description: "Report marked as resolved.", tone: "success" });
    } catch (e) {
      showToast({ title: "Failed", description: e.message, tone: "danger" });
    }
    return;
  }

  if (action === "admin-dismiss-report") {
    const reportId = button.dataset.id;
    if (!reportId) return;
    try {
      await adminUpdateReportStatus(reportId, "dismissed");
      setState({
        admin: {
          ...(state.admin || {}),
          adminReports: (state.admin?.adminReports || []).map((r) => r.id === reportId ? { ...r, status: "dismissed" } : r)
        }
      }, { scope: "view" });
      showToast({ title: "Dismissed", description: "Report dismissed.", tone: "success" });
    } catch (e) {
      showToast({ title: "Failed", description: e.message, tone: "danger" });
    }
    return;
  }

  if (action === "admin-ban-user") {
    const uid = button.dataset.id;
    if (!uid) return;
    openModal({
      title: "Ban this user?",
      body: "This will flag their account as banned. Their listings and activity will be hidden from the platform.",
      confirmLabel: "Ban",
      confirmTone: "btn--danger",
      icon: "gavel",
      onConfirm: async () => {
        try {
          await adminBanUserDb(uid);
          setState({
            admin: {
              ...(state.admin || {}),
              adminUsers: (state.admin?.adminUsers || []).map((u) => (u.uid === uid || u.id === uid) ? { ...u, banned: true } : u),
              adminReports: (state.admin?.adminReports || []).map((r) => r.targetId === uid ? { ...r, status: "resolved" } : r)
            }
          }, { scope: "view" });
          showToast({ title: "User banned", description: "Account flagged as banned.", tone: "success" });
        } catch (e) {
          showToast({ title: "Failed", description: e.message, tone: "danger" });
        }
      }
    });
    return;
  }
});

document.addEventListener("input", handleBoundInput);
document.addEventListener("change", handleBoundInput);

document.addEventListener("keydown", async (event) => {
  const signupForm = event.target.closest('form[data-form="signup"]');
  if (!signupForm || event.key !== "Enter" || event.shiftKey || event.target.tagName === "TEXTAREA") {
    return;
  }

  if (!isSignupFinalStep()) {
    event.preventDefault();
    goToNextSignupStep();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) {
    return;
  }

  event.preventDefault();

  if (form.dataset.form === "login") {
    await handleLogin();
    return;
  }

  if (form.dataset.form === "signup") {
    if (isSignupFinalStep()) {
      await handleSignup();
    } else {
      goToNextSignupStep();
    }
    return;
  }

  if (form.dataset.form === "listing") {
    await handleListingSubmit();
    return;
  }

  if (form.dataset.form === "message") {
    await handleMessageSubmit();
    return;
  }

  if (form.dataset.form === "requirement") {
    await handleRequirementSubmit();
    return;
  }

  if (form.dataset.form === "profile") {
    await handleProfileSubmit();
  }
});

subscribe((nextState, meta) => {
  if (meta.scope === "full") {
    renderShell();
    return;
  }

  if (meta.scope === "messages") {
    if (state.route === "messages") {
      renderView();
    }
    return;
  }

  if (meta.scope === "view") {
    renderView();
    return;
  }

  if (meta.scope === "data" && routeNeedsDataRefresh(nextState.route)) {
    const conversations = nextState.conversations || [];
    for (const conversation of conversations) {
      const id = conversation.id;
      const time = Number(conversation.lastMessageAt || conversation.lastTime || 0);
      if (!id || !time) {
        continue;
      }
      if (!seenConversationTimes.has(id)) {
        seenConversationTimes.set(id, time);
        continue;
      }
      const previous = seenConversationTimes.get(id) || 0;
      if (time > previous && nextState.route !== "messages") {
        updateState((draft) => {
          draft.ui.notifications = [
            {
              id: `${id}:${time}`,
              text: conversation.lastMessage || "You received a new message.",
              createdAt: time,
              unread: true
            },
            ...(draft.ui.notifications || [])
          ].slice(0, 10);
          persistNotifications(draft.ui.notifications);
        }, { scope: "full" });
        showToast({ title: "New message", description: conversation.lastMessage || "You received a new message.", tone: "info" });
      }
      seenConversationTimes.set(id, time);
    }
    renderView();
  }
});

async function handleAuthenticatedUser(firebaseUser) {
  let profile = await resolveUserProfile(firebaseUser);
  const signupReward = await claimOneTimeCredits(firebaseUser.uid, {
    flagField: "signupBonusGiven",
    amount: 50
  });

  if (signupReward.awarded) {
    profile = {
      ...profile,
      credits: signupReward.credits,
      signupBonusGiven: true
    };
  }

  const nextUser = {
    ...profile,
    uid: firebaseUser.uid,
    email: profile.email || firebaseUser.email || "",
    credits: profile.credits || 0,
    signupBonusGiven: Boolean(profile.signupBonusGiven),
    firstListingRewardGiven: Boolean(profile.firstListingRewardGiven)
  };

  const isAdmin = (profile?.email || firebaseUser.email || "").toLowerCase() === "admin@gmail.com";

  hydrateProfileForm(nextUser);
  resetTransientForms();
  setState(
    {
      authResolved: true,
      user: nextUser,
      isAdmin,
      route: isAdmin ? "admin" : (state.route || "dashboard"),
      admin: isAdmin ? { adminTab: "overview", adminStats: null, adminReports: [], adminUsers: [] } : null,
      ui: {
        ...state.ui,
        notifications: loadStoredNotifications()
      }
    },
    { scope: "full" }
  );

  if (isAdmin) {
    try {
      const [stats, reports, users] = await Promise.all([adminGetStats(), adminGetReports(), adminGetUsers()]);
      setState({ admin: { adminTab: "overview", adminStats: stats, adminReports: reports, adminUsers: users } }, { scope: "view" });
    } catch (e) {
      console.error("Admin data load failed", e);
    }
  }

  startRealtime();

  if (state.route === "messages" && !state.activeChatId && state.conversations.length) {
    const partnerId = getConversationPartnerId(state.conversations[0], firebaseUser.uid);
    if (partnerId) {
      watchActiveChat(partnerId);
    }
  }

  if (signupReward.awarded) {
    window.setTimeout(() => {
      openSignupBonusModal();
    }, 120);
  }
}

function bootstrap() {
  initToastHost();
  initModalHost();
  initRouter();

  if (!signupResendTicker) {
    signupResendTicker = window.setInterval(() => {
      if (state.user || state.ui.authMode !== "signup" || state.ui.authForm.step !== 2) {
        return;
      }
      updateAuthResendTimerNode();
    }, 1000);
  }

  observeAuth(async (firebaseUser) => {
    if (!firebaseUser) {
      stopRealtime();
      clearActiveChat();
      resetStateForLogout();
      setState(
        {
          authResolved: true,
          user: null,
          loading: {
            ...state.loading,
            auth: false,
            location: false
          }
        },
        { scope: "full" }
      );
      return;
    }

    try {
      await handleAuthenticatedUser(firebaseUser);
    } catch (error) {
      console.error(error);
      setAuthLoading(false);
      setAuthMessage({ error: "We couldn't load your account. Please refresh and try again.", notice: "" });
    }
  });

  renderShell();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}

window.navigate = navigate;
