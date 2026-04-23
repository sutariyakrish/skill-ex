import { LANGUAGE_OPTIONS, escapeHtml } from "../utils/helpers.js";
import { getPasswordStrength } from "../utils/validators.js";

const SIGNUP_STEPS = [
  { id: 1, label: "Basic details" },
  { id: 2, label: "Verify email" },
  { id: 3, label: "User type" },
  { id: 4, label: "Institution" },
  { id: 5, label: "Location" },
  { id: 6, label: "Languages" },
];

function getVisibleSignupSteps(form) {
  return SIGNUP_STEPS.filter(
    (step) => step.id !== 4 || form.userType === "Student",
  );
}

function formatCooldown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function renderPasswordField({
  id,
  label,
  fieldName,
  visible,
  value,
  helper,
  action,
  isLogin,
}) {
  return `
    <div class="space-y-1.5 w-full">
      <div class="flex justify-between items-center">
        <label class="font-label-md text-on-surface-variant text-sm ml-1" for="${id}">${label}</label>
        ${helper || ""}
      </div>
      <div class="relative group">
        <input
          class="w-full h-[48px] px-4 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 outline-none text-on-surface"
          id="${id}"
          name="${fieldName}"
          type="${visible ? "text" : "password"}"
          value="${escapeHtml(value)}"
          data-model="authForm"
          placeholder="•••••••••"
          autocomplete="current-password"
        >
        <button class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary p-1 focus:outline-none" type="button" data-action="${action}">
          <span class="material-symbols-outlined text-[20px]">${visible ? "visibility_off" : "visibility"}</span>
        </button>
      </div>
    </div>
  `;
}

function renderLanguageSuggestions(form) {
  const query = form.languageSearch.trim().toLowerCase();
  if (!query) {
    return "";
  }
  const suggestions = LANGUAGE_OPTIONS.filter(
    (language) =>
      !form.languages.includes(language) &&
      language.toLowerCase().includes(query),
  ).slice(0, 6);

  if (!suggestions.length) {
    return "";
  }

  return `
    <div class="absolute left-0 right-0 top-full mt-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-lg overflow-hidden z-10 flex flex-col">
      ${suggestions
        .map(
          (language) => `
        <button
          type="button"
          class="px-4 py-2 text-left hover:bg-surface-variant hover:text-primary transition-colors font-body-md text-sm text-on-surface"
          data-action="add-language"
          data-value="${escapeHtml(language)}"
        >
          ${escapeHtml(language)}
        </button>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderSignupStep(state) {
  const form = state.ui.authForm;
  const steps = getVisibleSignupSteps(form);
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === form.step),
  );
  const currentStep = steps[currentIndex] || steps[0];
  const strength = getPasswordStrength(form.password);
  const isFinalStep = currentIndex === steps.length - 1;

  let body = "";

  if (currentStep.id === 1) {
    body = `
      <div class="space-y-6 w-full animate-fade-in">
        <div>
          <h2 class="font-headline-md text-xl text-primary font-bold mb-1">Create your account</h2>
          <p class="font-body-md text-sm text-on-surface-variant">Join the elite network of professional experts.</p>
        </div>

        <div class="space-y-5">
          <div class="space-y-1.5">
            <label class="font-label-md text-on-surface-variant text-sm ml-1" for="auth-name">Full Name</label>
            <input class="w-full h-[48px] px-4 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 outline-none text-on-surface" id="auth-name" name="name" value="${escapeHtml(form.name)}" data-model="authForm" placeholder="John Doe" autocomplete="name">
          </div>

          <div class="space-y-1.5">
            <label class="font-label-md text-on-surface-variant text-sm ml-1" for="auth-email">Work Email</label>
            <input class="w-full h-[48px] px-4 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 outline-none text-on-surface" id="auth-email" name="email" type="email" value="${escapeHtml(form.email)}" data-model="authForm" placeholder="john@skillex.com" autocomplete="email">
          </div>

          <div>
            ${renderPasswordField({
              id: "auth-password",
              label: "Password",
              fieldName: "password",
              visible: form.showSignupPassword,
              value: form.password,
              action: "toggle-signup-password",
              isLogin: false,
            })}
            
            <!-- Password Strength Bar -->
            <div class="mt-3">
              <div class="flex gap-1 mb-1.5">
                <div class="h-1 flex-1 rounded-full ${strength.score > 0 ? "bg-primary" : "bg-surface-variant"}" data-password-strength-bar></div>
                <div class="h-1 flex-1 rounded-full ${strength.score > 1 ? "bg-primary" : "bg-surface-variant"}" data-password-strength-bar></div>
                <div class="h-1 flex-1 rounded-full ${strength.score > 2 ? "bg-primary" : "bg-surface-variant"}" data-password-strength-bar></div>
                <div class="h-1 flex-1 rounded-full ${strength.score > 3 ? "bg-primary" : "bg-surface-variant"}" data-password-strength-bar></div>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-[10px] uppercase font-bold tracking-wider ${strength.score >= 3 ? "text-primary" : "text-on-surface-variant"}" data-password-strength-label>${strength.score >= 3 ? "STRONG" : strength.score >= 2 ? "MEDIUM" : "WEAK"}</span>
                <span class="text-[10px] text-on-surface-variant">Min. 8 characters</span>
              </div>
            </div>
          </div>
        </div>

        <button class="w-full h-[48px] bg-primary/10 text-primary hover:bg-primary hover:text-on-primary font-label-md text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2" type="button" data-action="signup-next" ${state.loading.auth ? "disabled" : ""}>
          ${state.loading.auth ? "Processing..." : 'Next Step <span class="material-symbols-outlined text-[18px]">arrow_forward</span>'}
        </button>

        <div class="text-center pt-2">
          <p class="font-body-md text-sm text-on-surface-variant">
            Already have an account? 
            <button class="text-primary font-bold hover:underline underline-offset-4" type="button" data-action="switch-auth-mode">
              Log in
            </button>
          </p>
        </div>
      </div>
    `;
  } else if (currentStep.id === 2) {
    const remainingMs = Math.max(0, (form.resendAvailableAt || 0) - Date.now());
    const canResend = remainingMs <= 0;

    body = `
      <div class="space-y-8 w-full text-center animate-fade-in flex flex-col items-center">
        <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <span class="material-symbols-outlined text-[32px] text-primary">mark_email_unread</span>
        </div>

        <div>
          <h2 class="font-headline-md text-2xl text-primary font-bold mb-3 leading-tight">We've sent a verification link to your email</h2>
          <p class="font-body-md text-sm text-on-surface-variant max-w-[300px] mx-auto">
            Please check your inbox and click the verification link to continue setting up your expert profile.
          </p>
        </div>

        <div class="w-full space-y-4">
          <button type="button" class="w-full h-[48px] bg-primary text-on-primary hover:bg-primary/90 font-label-md text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2" data-action="signup-check-email" ${state.loading.auth ? "disabled" : ""}>
            I have verified <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
          
          <div class="pt-2">
            <p class="font-body-md text-sm text-on-surface-variant mb-3">Didn't receive it?</p>
            <div class="flex items-center justify-center gap-4">
              <button type="button" class="font-label-md text-sm font-bold flex items-center gap-1 ${canResend ? "text-primary hover:underline" : "text-on-surface-variant opacity-50 cursor-not-allowed"}" data-action="signup-resend-email" ${canResend ? "" : "disabled"}>
                <span class="material-symbols-outlined text-[16px]">refresh</span> Resend Email
              </button>
              ${!canResend ? `<span class="bg-surface-variant text-on-surface-variant px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider" data-auth-resend-timer data-end-at="${form.resendAvailableAt || 0}">${formatCooldown(remainingMs)}</span>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    body = `
      <div class="space-y-6 w-full animate-fade-in">
        <div>
          <div class="flex items-center justify-between mb-3 pb-3 border-b border-outline-variant/20 relative">
            <span class="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Step ${currentIndex + 1} of ${steps.length}</span>
            <span class="text-xs font-bold text-on-surface-variant">${currentStep.label}</span>
            <div class="absolute bottom-0 left-0 h-0.5 bg-primary rounded-full transition-all duration-300" style="width: ${((currentIndex + 1) / steps.length) * 100}%"></div>
          </div>
          <h2 class="font-headline-md text-xl text-primary font-bold mb-1">${currentStep.label}</h2>
          <p class="font-body-md text-sm text-on-surface-variant">Complete your profile to get started.</p>
        </div>

        <div class="space-y-5">
          ${
            currentStep.id === 3
              ? `
            <div class="space-y-3">
              <span class="font-label-md text-on-surface-variant text-sm ml-1">Choose your user type</span>
              <div class="grid grid-cols-1 gap-3">
                ${["Student", "General User"]
                  .map(
                    (userType) => `
                  <button type="button" class="w-full text-left p-4 rounded-xl border-2 transition-all duration-150 ${form.userType === userType ? "border-primary bg-primary/10 shadow-sm" : "border-outline-variant/30 bg-transparent hover:border-primary/50 hover:bg-primary/5"}" data-action="set-user-type" data-value="${escapeHtml(userType)}">
                    <div class="flex items-center justify-between mb-1">
                      <strong class="text-sm ${form.userType === userType ? "text-primary" : "text-on-surface"}">${escapeHtml(userType)}</strong>
                      ${form.userType === userType ? `<span class="material-symbols-outlined text-primary" style="font-size:20px;">check_circle</span>` : `<span class="w-5 h-5 rounded-full border-2 border-outline-variant/50 inline-block flex-shrink-0"></span>`}
                    </div>
                    <span class="block text-xs ${form.userType === userType ? "text-primary/70" : "text-on-surface-variant"}">${userType === "Student" ? "School, college, or institute based account" : "Independent learner, professional, or enthusiast"}</span>
                  </button>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
          
          ${
            currentStep.id === 4
              ? `
            <div class="space-y-1.5">
              <label class="font-label-md text-on-surface-variant text-sm ml-1" for="auth-institution">School / College Name</label>
              <input class="w-full h-[48px] px-4 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none text-on-surface" id="auth-institution" name="institution" value="${escapeHtml(form.institution)}" data-model="authForm" placeholder="Delhi University">
            </div>
          `
              : ""
          }
          
          ${
            currentStep.id === 5
              ? `
            <div class="space-y-4">
              <button class="w-full h-[48px] bg-surface-variant text-on-surface hover:text-primary rounded-lg font-label-md text-sm transition-colors" type="button" data-action="detect-location">
                ${state.loading.location ? "Detecting location..." : "Use my current location"}
              </button>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="font-label-md text-on-surface-variant text-xs ml-1">Country</label>
                  <input class="w-full h-[40px] px-3 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary outline-none text-sm text-on-surface" name="location.country" value="${escapeHtml(form.location.country)}" data-model="authForm">
                </div>
                <div class="space-y-1.5">
                  <label class="font-label-md text-on-surface-variant text-xs ml-1">State</label>
                  <input class="w-full h-[40px] px-3 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary outline-none text-sm text-on-surface" name="location.state" value="${escapeHtml(form.location.state)}" data-model="authForm">
                </div>
                <div class="space-y-1.5">
                  <label class="font-label-md text-on-surface-variant text-xs ml-1">City</label>
                  <input class="w-full h-[40px] px-3 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary outline-none text-sm text-on-surface" name="location.city" value="${escapeHtml(form.location.city)}" data-model="authForm">
                </div>
                <div class="space-y-1.5">
                  <label class="font-label-md text-on-surface-variant text-xs ml-1">Pincode</label>
                  <input class="w-full h-[40px] px-3 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary outline-none text-sm text-on-surface" name="location.pincode" value="${escapeHtml(form.location.pincode)}" data-model="authForm">
                </div>
              </div>
            </div>
          `
              : ""
          }
          
          ${
            currentStep.id === 6
              ? `
            <div class="space-y-4">
              <div class="relative">
                <input class="w-full h-[48px] px-4 rounded-lg border border-outline-variant/50 bg-transparent focus:border-primary outline-none text-on-surface" name="languageSearch" value="${escapeHtml(form.languageSearch)}" data-model="authForm" placeholder="Search languages..." autocomplete="off">
                ${renderLanguageSuggestions(form)}
              </div>
              <div class="flex flex-wrap gap-2">
                ${form.languages
                  .map(
                    (language) => `
                  <span class="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">
                    ${escapeHtml(language)}
                    <button type="button" class="hover:text-error transition-colors" data-action="remove-language" data-value="${escapeHtml(language)}">
                      <span class="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>

        <div class="flex gap-3 pt-4 border-t border-outline-variant/20 mt-4">
          <button class="flex-1 h-[48px] bg-transparent border border-outline-variant/50 hover:border-primary text-on-surface hover:text-primary font-label-md text-sm font-bold rounded-lg transition-colors" type="button" data-action="signup-back" ${currentIndex === 0 || state.loading.auth ? "disabled" : ""}>
            Back
          </button>
          ${
            isFinalStep
              ? `
            <button class="flex-[2] h-[48px] bg-primary text-on-primary hover:bg-primary/90 font-label-md text-sm font-bold rounded-lg transition-colors" type="submit" ${state.loading.auth ? "disabled" : ""}>
              ${state.loading.auth ? "Finishing..." : "Complete Setup"}
            </button>
          `
              : `
            <button class="flex-[2] h-[48px] bg-primary text-on-primary hover:bg-primary/90 font-label-md text-sm font-bold rounded-lg transition-colors" type="button" data-action="signup-next" ${state.loading.auth ? "disabled" : ""}>
              Next Step
            </button>
          `
          }
        </div>
      </div>
    `;
  }

  return `
    <div class="w-full">
      ${
        currentStep.id === 1
          ? `
        <div class="flex items-center justify-between mb-8 border-b border-outline-variant/30 pb-4">
          <span class="text-xs font-bold text-on-surface-variant tracking-wider uppercase">Step ${currentIndex + 1} of ${steps.length}</span>
          <span class="text-sm font-bold text-on-surface-variant">${currentStep.label}</span>
          <div class="absolute top-0 left-0 h-0.5 bg-primary transition-all duration-300" style="width: ${((currentIndex + 1) / steps.length) * 100}%"></div>
        </div>
      `
          : ""
      }
      ${body}
      
      ${
        currentStep.id === 2
          ? `
        <div class="mt-8 pt-6 border-t border-outline-variant/20 text-center text-sm text-on-surface-variant">
          Wrong email address? 
          <button class="font-bold text-primary hover:underline" type="button" data-action="signup-back">Change it here</button>
        </div>
      `
          : ""
      }
    </div>
  `;
}

export function renderAuthView(state) {
  const isSignup = state.ui.authMode === "signup";
  const form = state.ui.authForm;
  const isVerifyStep =
    isSignup &&
    getVisibleSignupSteps(form)[
      Math.max(
        0,
        getVisibleSignupSteps(form).findIndex((step) => step.id === form.step),
      )
    ]?.id === 2;

  return `
    <div class="min-h-screen flex flex-col" style="background: var(--bg); color: var(--text-primary);">
      <!-- Auth Header -->
      <header class="w-full h-16 flex items-center justify-between px-6 lg:px-10 border-b" style="border-color: var(--line); background: var(--surface);">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-md flex items-center justify-center" style="background: var(--accent);">
            <span class="material-symbols-outlined text-white" style="font-size:14px;">bolt</span>
          </div>
          <h1 class="font-headline-md font-bold text-lg tracking-tight" style="color: var(--text-primary);">Skill<span style="color: var(--accent);">EX</span></h1>
        </div>
        <button class="icon-btn" data-action="toggle-theme" aria-label="Toggle theme">
          <span class="material-symbols-outlined" style="font-size:18px;">contrast</span>
        </button>
      </header>

      <!-- Main Content Area -->
      <main class="flex-grow flex flex-col px-4 py-12 relative">
        <!-- Ambient glow -->
        <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,111,255,0.08), transparent);"></div>
        
        <div class="m-auto w-full max-w-[440px] relative z-10 animate-fade-in">
          <div class="card p-8">
            <form class="flex flex-col gap-6" data-form="${isSignup ? "signup" : "login"}" autocomplete="on">
              ${
                isSignup
                  ? renderSignupStep(state)
                  : `
                <div class="flex flex-col gap-6">
                  <div class="text-center">
                    <h2 class="font-headline-md font-bold text-xl text-primary mb-1">Welcome back</h2>
                    <p class="text-sm text-on-surface-variant">Sign in to continue to SkillEX</p>
                  </div>

                  <div class="flex flex-col gap-4">
                    <div class="form-group">
                      <label class="form-label" for="auth-email">Email</label>
                      <input
                        class="input"
                        id="auth-email"
                        name="email"
                        type="email"
                        data-model="authForm"
                        value="${escapeHtml(form.email)}"
                        placeholder="you@example.com"
                        autocomplete="email"
                      >
                    </div>

                    <div class="form-group">
                      <div class="flex items-center justify-between mb-1.5">
                        <label class="form-label mb-0" for="auth-password">Password</label>
                        <button type="button" data-action="reset-password"
                          class="text-xs font-semibold transition-colors hover:text-primary"
                          style="color: var(--accent);">Forgot password?</button>
                      </div>
                      <div class="relative">
                        <input
                          class="input pr-10"
                          id="auth-password"
                          name="password"
                          type="${form.showLoginPassword ? "text" : "password"}"
                          data-model="authForm"
                          value="${escapeHtml(form.password)}"
                          placeholder="••••••••"
                          autocomplete="current-password"
                        >
                        <button type="button"
                          class="absolute right-2.5 top-1/2 -translate-y-1/2 icon-btn w-7 h-7"
                          data-action="toggle-login-password" aria-label="Toggle password">
                          <span class="material-symbols-outlined" style="font-size:16px;">${form.showLoginPassword ? "visibility_off" : "visibility"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button class="btn-primary w-full h-11" type="submit" ${state.loading.auth ? "disabled" : ""}>
                    ${state.loading.auth
                      ? `<span class="material-symbols-outlined" style="font-size:16px;">progress_activity</span> Signing in…`
                      : "Sign in"}
                  </button>

                  <p class="text-center text-sm text-on-surface-variant">
                    Don't have an account?
                    <button data-action="switch-auth-mode"
                      class="font-semibold transition-colors hover:text-primary ml-1" style="color: var(--accent);">Create one</button>
                  </p>
                </div>
              `
              }

              ${
                state.ui.authError
                  ? `
                <div class="flex items-center gap-2.5 p-3 rounded-md text-sm" style="background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.2); color: var(--danger);">
                  <span class="material-symbols-outlined shrink-0" style="font-size:18px;">error</span>
                  ${escapeHtml(state.ui.authError)}
                </div>
              `
                  : ""
              }
              ${state.ui.authNotice ? `
                <div class="flex items-center gap-2.5 p-3 rounded-md text-sm" style="background: rgba(124,111,255,0.08); border: 1px solid rgba(124,111,255,0.2); color: var(--accent);">
                  ${escapeHtml(state.ui.authNotice)}
                </div>
              ` : ""}
            </form>
          </div>

          <!-- Trust badges -->
          ${
            isSignup && !isVerifyStep
              ? `
            <div class="flex items-center justify-center gap-6 mt-6 opacity-60">
              <div class="flex items-center gap-1.5 text-xs text-on-surface-variant font-semibold">
                <span class="material-symbols-outlined" style="font-size:14px;">lock</span> Enterprise Secure
              </div>
              <div class="flex items-center gap-1.5 text-xs text-on-surface-variant font-semibold">
                <span class="material-symbols-outlined" style="font-size:14px;">shield</span> GDPR Compliant
              </div>
            </div>
          `
              : ""
          }
        </div>
      </main>

      <!-- Footer -->
      <footer class="w-full py-6 border-t border-outline-variant text-center">
        <div class="flex items-center justify-center gap-6 text-xs text-on-surface-variant">
          <button class="hover:text-primary transition-colors">Privacy Policy</button>
          <button class="hover:text-primary transition-colors">Terms of Service</button>
          <button class="hover:text-primary transition-colors">Support</button>
        </div>
        <p class="text-[10px] text-on-surface-variant opacity-40 mt-2 uppercase tracking-widest">© 2024 SkillEX</p>
      </footer>
    </div>
  `;
}
