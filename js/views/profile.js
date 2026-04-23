import { LANGUAGE_OPTIONS, escapeHtml, renderAvatar } from "../utils/helpers.js";

export function renderProfileView(state) {
  const form = state.ui.profileForm;

  return `
    <section class="flex flex-col lg:flex-row gap-6 p-4 md:p-8 max-w-6xl mx-auto">
      <div class="flex-1 flex flex-col gap-6">
        <div class="card relative overflow-hidden">
          <!-- Subtle glow effect behind card content -->
          <div class="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[60px] pointer-events-none"></div>
          
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-surface-variant shrink-0 bg-surface-variant flex items-center justify-center font-bold text-primary text-xl">
                ${renderAvatar(state.user, "w-full h-full flex items-center justify-center")}
              </div>
              <div class="flex flex-col gap-1.5">
                <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Your identity</span>
                <h2 class="text-2xl font-bold text-primary">${escapeHtml(state.user.name)}</h2>
                <p class="text-sm text-on-surface-variant">${escapeHtml(state.user.headline || "Tell people what you are great at.")}</p>
              </div>
            </div>
            <div class="flex sm:flex-col gap-2 justify-end">
              <span class="badge bg-transparent border border-outline-variant/50">${escapeHtml((state.user.languages || []).length)} languages</span>
              <span class="badge-primary">${escapeHtml(state.user.credits || 0)} credits</span>
            </div>
          </div>
        </div>

        <div class="card">
          <form class="flex flex-col gap-6" data-form="profile">
            <div class="flex flex-col sm:flex-row gap-4">
              <div class="flex flex-col gap-1.5 w-full">
                <label class="text-sm font-bold text-on-surface-variant ml-1" for="profile-name">Name</label>
                <input class="input" id="profile-name" name="name" data-model="profileForm" value="${escapeHtml(form.name)}">
              </div>
              <div class="flex flex-col gap-1.5 w-full">
                <label class="text-sm font-bold text-on-surface-variant ml-1" for="profile-email">Email</label>
                <input class="input" id="profile-email" type="email" name="email" data-model="profileForm" value="${escapeHtml(form.email)}">
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-on-surface-variant ml-1" for="profile-headline">Headline</label>
              <input class="input" id="profile-headline" name="headline" data-model="profileForm" value="${escapeHtml(form.headline)}" placeholder="Frontend engineer helping teams ship polished products">
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-bold text-on-surface-variant ml-1" for="profile-bio">Bio</label>
              <textarea class="input min-h-[120px] py-3 resize-y" id="profile-bio" name="bio" data-model="profileForm" placeholder="Share what you can teach, trade, or help with.">${escapeHtml(form.bio)}</textarea>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                <span class="text-sm font-bold text-on-surface-variant">Languages</span>
                <span class="text-xs text-on-surface-variant">Multi-select</span>
              </div>
              <div class="flex flex-wrap gap-2">
                ${LANGUAGE_OPTIONS.map(
                  (language) => `
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${form.languages.includes(language) ? "bg-primary/10 text-primary border-primary/30" : "bg-transparent text-on-surface-variant border-outline-variant/50 hover:border-primary/50 hover:text-primary"}"
                      data-action="toggle-language"
                      data-source="profile"
                      data-value="${escapeHtml(language)}"
                    >
                      ${escapeHtml(language)}
                    </button>
                  `
                ).join("")}
              </div>
            </div>

            <div class="pt-4 mt-2 border-t border-outline-variant/30 flex justify-end">
              <button class="btn-primary" type="submit" ${state.loading.profile ? "disabled" : ""}>
                ${state.loading.profile ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <aside class="w-full lg:w-80 flex flex-col gap-6">
        <div class="card">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Summary</span>
              <h3 class="text-lg font-bold text-primary">Profile health</h3>
            </div>
            
            <div class="flex flex-col gap-3">
              <div class="flex justify-between items-center py-2 border-b border-outline-variant/20">
                <span class="text-sm text-on-surface-variant">Credits</span>
                <strong class="text-primary font-bold">${state.user.credits || 0}</strong>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-outline-variant/20">
                <span class="text-sm text-on-surface-variant">Listings</span>
                <strong class="text-primary font-bold">${state.marketplace.filter((listing) => listing.uid === state.user.uid).length}</strong>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-outline-variant/20">
                <span class="text-sm text-on-surface-variant">Conversations</span>
                <strong class="text-primary font-bold">${state.conversations.length}</strong>
              </div>
              <div class="flex justify-between items-center py-2">
                <span class="text-sm text-on-surface-variant">Meetings</span>
                <strong class="text-primary font-bold">${state.meetings.length}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="flex flex-col gap-4">
            <span class="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Visible languages</span>
            <div class="flex flex-wrap gap-2">
              ${(state.user.languages || []).length ? state.user.languages.map((language) => `<span class="badge bg-surface-variant">${escapeHtml(language)}</span>`).join("") : '<span class="text-sm text-on-surface-variant italic">No languages added yet.</span>'}
            </div>
          </div>
        </div>
      </aside>
    </section>
  `;
}
