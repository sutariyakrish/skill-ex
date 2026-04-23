import {
  LISTING_TYPES,
  escapeHtml,
  formatRating,
  formatRelativeTime,
  normaliseTags,
  renderAvatar
} from "../utils/helpers.js";
function keywordScore(query, listing) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!words.length) {
    return 0;
  }
  const haystack = `${listing.title} ${listing.description} ${(listing.tags || []).join(" ")}`.toLowerCase();
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0) / words.length;
}

function filterListings(state) {
  const {
    search,
    locationCountry,
    locationState,
    locationCity,
    locationLocality,
    languages,
    listingType,
    sortBy
  } = state.ui.marketplaceFilters;

  const blockedSet = new Set(state.user?.blockedUsers || []);

  const filtered = state.marketplace.filter((listing) => {
    if (listing.unavailable) return false;
    const ownerId = listing.uid || listing.ownerId;
    if (ownerId === state.user.uid) return false;
    if (blockedSet.has(ownerId)) return false;

    const haystack = [listing.title, listing.description, listing.name, ...(listing.tags || []), listing.category, listing.listingType]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());

    let matchesLocation = true;
    if (state.ui.marketplaceFilters.locationType && state.ui.marketplaceFilters.locationType !== "all" && state.user?.location) {
      const type = state.ui.marketplaceFilters.locationType;
      const userLoc = String(state.user.location[type] || "").toLowerCase();
      const listingLoc = String(listing.location?.[type] || "").toLowerCase();
      matchesLocation = userLoc && listingLoc && userLoc === listingLoc;
    }

    const selectedLanguages = Array.isArray(languages) ? languages : [];
    const matchesLanguage =
      !selectedLanguages.length ||
      selectedLanguages.every((selected) => (listing.languages || []).some((entry) => String(entry).toLowerCase() === String(selected).toLowerCase()));
    const matchesType = listingType === "all" || listing.listingType === listingType;

    return matchesSearch && matchesLocation && matchesLanguage && matchesType;
  });

  if (sortBy === "price") {
    filtered.sort((a, b) => (Number(a.creditPrice) || 0) - (Number(b.creditPrice) || 0));
  } else if (sortBy === "rating") {
    filtered.sort((a, b) => (Number(b.sellerRating) || 0) - (Number(a.sellerRating) || 0));
  } else {
    filtered.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  }

  return filtered;
}

function getRecommendations(state) {
  const query = (state.ui.marketplaceFilters.search || "").trim();
  const myLanguages = new Set((state.user.languages || []).map((entry) => entry.toLowerCase()));
  return state.marketplace
    .filter((listing) => listing.uid !== state.user.uid && listing.ownerId !== state.user.uid)
    .map((listing) => {
      const typeMatch = listing.listingType === state.ui.requirementForm.listingType ? 1 : 0.5;
      const languageMatch = (listing.languages || []).some((entry) => myLanguages.has(String(entry).toLowerCase())) ? 1 : 0;
      const wordsMatch = keywordScore(query, listing);
      return { listing, score: typeMatch + languageMatch + wordsMatch };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.listing);
}

export function renderMarketplaceView(state) {
  const filterState = state.ui.marketplaceFilters;
  const listings = filterListings(state);
  const recommendations = getRecommendations(state);
  const languages = [...new Set(state.marketplace.flatMap((entry) => entry.languages || []).filter(Boolean))];
  const languageSearchQuery = String(filterState.languageSearch || "").trim().toLowerCase();
  const languageSuggestions = languageSearchQuery
    ? languages.filter((entry) => !filterState.languages.includes(entry) && entry.toLowerCase().includes(languageSearchQuery)).slice(0, 8)
    : [];
  const requirement = state.ui.requirementForm;
  const myRequirements = (state.requirements || []).filter((entry) => entry.uid === state.user.uid);
  const hasRequirementMatch = myRequirements.length > 0 && recommendations.length > 0;
  const activeFilterChips = [
    ...(filterState.listingType !== "all" ? [{ key: "listingType", label: `Type: ${filterState.listingType}` }] : []),
    ...(filterState.locationType !== "all" ? [{ key: "locationType", label: `Location: My ${filterState.locationType}` }] : []),
    ...(filterState.languages || []).map((entry) => ({ key: "languages", value: entry, label: `Lang: ${entry}` }))
  ];

  return `
    <section class="page-section animate-fade-in">

      <!-- ── Search & Filters ── -->
      <div class="card gap-4 rounded-2xl shadow-md">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">tune</span>
            <h3 class="font-headline-md text-base font-bold text-primary">Marketplace Filters</h3>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="md:hidden btn-secondary h-8 px-3 text-xs" data-action="toggle-marketplace-filters">
              ${state.ui.marketplaceFiltersOpen ? "Hide" : "Show"}
            </button>
            <button type="button" class="btn-ghost h-8 px-3 text-xs" data-action="clear-all-filters">Clear All</button>
          </div>
        </div>

        <div class="relative w-full h-11 bg-surface border border-outline-variant rounded-lg flex items-center px-3 gap-2 transition-all focus-within:border-outline">
          <span class="material-symbols-outlined text-on-surface-variant" style="font-size:18px;">search</span>
          <input
            name="search"
            data-model="marketplaceFilters"
            value="${escapeHtml(filterState.search)}"
            placeholder="Search skills, resources, topics…"
            class="flex-1 h-full bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
          >
        </div>

        <div class="${state.ui.marketplaceFiltersOpen ? "flex" : "hidden"} md:flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Listing Type</span>
            <div class="flex flex-wrap gap-2">
              ${[
                { value: "skill", label: "Skills" },
                { value: "resource", label: "Resources" },
                { value: "book", label: "Books" },
                { value: "service", label: "Services" }
              ].map((entry) => `
                <button
                  type="button"
                  class="px-3 h-8 rounded-full border text-xs font-semibold transition-colors ${filterState.listingType === entry.value ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/60"}"
                  data-action="set-marketplace-filter"
                  data-filter="listingType"
                  data-value="${entry.value}"
                >
                  ${entry.label}
                </button>
              `).join("")}
              <button type="button" class="px-3 h-8 rounded-full border border-outline-variant text-xs text-on-surface-variant hover:text-primary" data-action="clear-filter" data-filter="listingType">Clear</button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Location</span>
            <div class="flex flex-wrap gap-2">
              ${[
                { value: "country", label: "Country" },
                { value: "state", label: "State" },
                { value: "city", label: "City" },
                { value: "pincode", label: "Pincode" }
              ].map((entry) => `
                <button
                  type="button"
                  class="px-3 h-8 rounded-full border text-xs font-semibold transition-colors ${filterState.locationType === entry.value ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/60"}"
                  data-action="set-marketplace-filter"
                  data-filter="locationType"
                  data-value="${entry.value}"
                >
                  ${entry.label}
                </button>
              `).join("")}
              <button type="button" class="px-3 h-8 rounded-full border border-outline-variant text-xs text-on-surface-variant hover:text-primary" data-action="clear-filter" data-filter="locationType">Clear</button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Sort By</span>
            <div class="flex flex-wrap gap-2">
              ${[
                { value: "newest", label: "Newest" },
                { value: "price", label: "Price" },
                { value: "rating", label: "Rating" }
              ].map((entry) => `
                <button type="button" class="px-3 h-8 rounded-full border text-xs font-semibold transition-colors ${filterState.sortBy === entry.value ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/60"}" data-action="set-marketplace-filter" data-filter="sortBy" data-value="${entry.value}">${entry.label}</button>
              `).join("")}
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Language Filter</label>
            <div class="relative">
              <input
                class="input h-9 text-sm"
                name="languageSearch"
                data-model="marketplaceFilters"
                value="${escapeHtml(filterState.languageSearch || "")}"
                placeholder="Search languages..."
                autocomplete="off"
              >
              ${languageSearchQuery && languageSuggestions.length ? `
                <div class="absolute z-20 top-full mt-1 left-0 right-0 bg-surface border border-outline-variant rounded-lg shadow-md overflow-hidden">
                  ${languageSuggestions.map((entry) => `
                    <button
                      type="button"
                      class="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-surface-muted"
                      data-action="add-marketplace-language"
                      data-value="${escapeHtml(entry)}"
                    >${escapeHtml(entry)}</button>
                  `).join("")}
                </div>
              ` : ""}
            </div>
            <div class="flex flex-wrap gap-2">
              ${(filterState.languages || []).map((entry) => `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  ${escapeHtml(entry)}
                  <button type="button" data-action="remove-marketplace-language" data-value="${escapeHtml(entry)}">
                    <span class="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              `).join("")}
              <button type="button" class="text-xs text-primary hover:underline" data-action="clear-filter" data-filter="languages">Clear</button>
            </div>
          </div>
        </div>

        ${activeFilterChips.length ? `
          <div class="flex flex-wrap gap-2 pt-1">
            ${activeFilterChips.map((chip) => `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-muted text-on-surface text-xs">
                ${escapeHtml(chip.label)}
                <button type="button" data-action="remove-filter-chip" data-filter="${chip.key}" ${chip.value ? `data-value="${escapeHtml(chip.value)}"` : ""}>
                  <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            `).join("")}
          </div>
        ` : ""}
      </div>

      <div class="flex flex-col lg:flex-row gap-6">

        <!-- ── Main Listing Grid ── -->
        <div class="flex-1 flex flex-col gap-8">

          <!-- Recommendations -->
          ${hasRequirementMatch ? `
            <div class="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div class="flex items-center gap-2 mb-4">
                <span class="material-symbols-outlined" style="color: var(--warning); font-size:18px;">auto_awesome</span>
                <h2 class="font-headline-md font-bold text-base text-primary">Recommended for You</h2>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                ${recommendations.map((listing) => renderMarketplaceCard(listing, listing.uid === state.user.uid || listing.ownerId === state.user.uid)).join("")}
              </div>
            </div>
          ` : ""}

          <!-- All Listings -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-headline-md font-bold text-base text-primary">All Listings</h2>
              <span class="text-xs text-on-surface-variant">${listings.length} results</span>
            </div>
            ${listings.length ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                ${listings.map((listing) => renderMarketplaceCard(listing, listing.uid === state.user.uid || listing.ownerId === state.user.uid)).join("")}
              </div>
              ${state.ui.pagination?.marketplaceHasMore ? `
                <div class="mt-4 flex justify-center">
                  <button
                    type="button"
                    class="btn-secondary h-9 px-4"
                    data-action="load-more-marketplace"
                    ${state.ui.pagination?.marketplaceLoadingMore ? "disabled" : ""}
                  >
                    ${state.ui.pagination?.marketplaceLoadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              ` : ""}
            ` : `
              <div class="card flex flex-col items-center justify-center text-center py-16 gap-3">
                <span class="material-symbols-outlined text-on-surface-variant" style="font-size:40px;">search_off</span>
                <p class="font-semibold text-primary">No listings match your filter</p>
                <p class="text-sm text-on-surface-variant">Try adjusting the search or type filter above.</p>
              </div>
            `}
          </div>
        </div>

        <!-- ── Requirements Sidebar ── -->
        <aside class="w-full lg:w-72 shrink-0">
          <div class="card sticky top-20">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined" style="color:var(--accent); font-size:18px;">assignment</span>
              <h3 class="font-bold text-sm text-primary">Post a Requirement</h3>
            </div>
            <p class="text-xs text-on-surface-variant">Tell us what you need and we'll match you better.</p>

            <form class="flex flex-col gap-3" data-form="requirement">
              <div class="form-group">
                <label class="form-label">What do you need?</label>
                <textarea name="text" data-model="requirementForm"
                  placeholder="e.g. Python mentoring in Hindi…"
                  class="textarea text-sm" style="min-height:80px;">${escapeHtml(requirement.text)}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Type</label>
                <select name="listingType" data-model="requirementForm" class="input h-9 text-sm">
                  ${LISTING_TYPES.map((option) => `<option value="${option.value}" ${requirement.listingType === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
                </select>
              </div>
              <button class="btn-primary w-full" type="submit">
                <span class="material-symbols-outlined" style="font-size:16px;">send</span>
                Submit Requirement
              </button>
            </form>
            <div class="mt-4 pt-4 border-t border-outline-variant/30">
              <h4 class="font-semibold text-sm text-primary mb-2">My Requirements</h4>
              ${myRequirements.length
                ? `
                <div class="flex flex-col gap-2">
                  ${myRequirements
                    .map(
                      (item) => `
                    <article class="rounded-lg border border-outline-variant/40 p-3 bg-surface-muted/40">
                      <p class="text-xs text-on-surface-variant mb-1">${escapeHtml(item.listingType || "skill")}</p>
                      <p class="text-sm text-on-surface">${escapeHtml(item.text || "")}</p>
                      <div class="flex items-center gap-2 mt-2">
                        <button type="button" class="btn-secondary h-8 text-xs flex-1" data-action="edit-requirement" data-id="${item.id}">Edit</button>
                        <button type="button" class="btn-danger h-8 text-xs flex-1" data-action="delete-requirement" data-id="${item.id}">Delete</button>
                      </div>
                    </article>
                  `,
                    )
                    .join("")}
                </div>
              `
                : `<p class="text-xs text-on-surface-variant">No requirements added yet.</p>`}
            </div>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function renderMarketplaceCard(listing, isMine) {
  const typeIsSkill = listing.listingType === "skill";
  const typeColors = {
    skill: "badge-brand",
    resource: "badge",
    book: "badge",
    service: "badge"
  };
  const badgeClass = typeColors[listing.listingType] || "badge";
  const rating = Number(listing.sellerRating || 0);
  const ratingStars = rating > 0
    ? `<span class="material-symbols-outlined" style="font-size:11px; color: var(--warning);">star</span><span>${rating.toFixed(1)}</span>`
    : `<span class="text-on-surface-variant/50">New</span>`;

  return `
    <article class="card flex flex-col gap-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-outline p-5">
      <div class="flex justify-between items-start gap-2">
        <span class="${badgeClass} text-[10px] px-2 py-0.5 h-auto capitalize">${escapeHtml(listing.listingType)}</span>
        <span class="flex items-center gap-0.5 text-xs font-semibold shrink-0" style="color: var(--warning);">
          ${ratingStars}
        </span>
      </div>

      <div class="flex-1">
        <h3 class="font-headline-md font-semibold text-sm text-primary mb-1 line-clamp-2 leading-snug">${escapeHtml(listing.title)}</h3>
        <p class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">${escapeHtml(listing.description)}</p>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-outline-variant mt-auto">
        <div>
          <p class="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Price</p>
          <p class="font-headline-md font-bold text-primary text-sm">${escapeHtml(String(listing.creditPrice || listing.priceLabel || "0"))} <span class="text-xs font-normal text-on-surface-variant">CRD</span></p>
        </div>
        <div class="text-right">
          <p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--accent);">${escapeHtml(listing.sellerLevel || "New")}</p>
          <p class="text-[10px] text-on-surface-variant">${escapeHtml(listing.name || "Seller")}</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5">
        ${isMine ? `
          <div class="flex items-center justify-center bg-surface-muted text-on-surface-variant rounded-md flex-1 h-8 text-xs font-semibold border border-outline-variant/30">Your listing</div>
          <button class="btn-danger h-8 px-2.5 text-xs shrink-0" data-action="delete-listing" data-id="${listing.rawId || listing.id}" data-source="${listing.sourceCollection || "listings"}" title="Delete listing">
            <span class="material-symbols-outlined" style="font-size:15px;">delete</span>
          </button>
        ` : `
          <button class="btn-primary flex-1 min-w-0 h-8 text-xs" data-action="offer-trade" data-trade-type="credit" data-listing-id="${listing.id}" data-user-id="${listing.uid || listing.ownerId}">Buy (CRD)</button>
          <button class="btn-secondary flex-1 min-w-0 h-8 text-xs" data-action="offer-trade" data-trade-type="barter" data-listing-id="${listing.id}" data-user-id="${listing.uid || listing.ownerId}">Barter</button>
          <button class="icon-btn w-8 h-8 shrink-0 text-on-surface-variant hover:text-danger transition-colors" style="min-height: unset; border-radius: 8px; background: var(--surface-muted);"
            data-action="report-listing" data-id="${listing.rawId || listing.id}" title="Report listing">
            <span class="material-symbols-outlined" style="font-size:15px;">flag</span>
          </button>
          <button class="icon-btn w-8 h-8 shrink-0 text-on-surface-variant hover:text-amber-400 transition-colors" style="min-height:unset;border-radius:8px;background:var(--surface-muted);"
            data-action="report-user" data-user-id="${listing.uid || listing.ownerId}" title="Report user">
            <span class="material-symbols-outlined" style="font-size:14px;">person_alert</span>
          </button>
          <button class="icon-btn w-8 h-8 shrink-0 text-on-surface-variant hover:text-red-400 transition-colors" style="min-height:unset;border-radius:8px;background:var(--surface-muted);"
            data-action="block-user" data-user-id="${listing.uid || listing.ownerId}" title="Block user">
            <span class="material-symbols-outlined" style="font-size:14px;">block</span>
          </button>
        `}
      </div>
    </article>
  `;
}
