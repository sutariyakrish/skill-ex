import { CREATE_LISTING_TYPES, escapeHtml, formatRating } from "../utils/helpers.js";
import { getPricingRules, validateListingPrice } from "../utils/progression.js";
import { validateListingForm } from "../utils/validators.js";

export function renderCreateListingView(state) {
  const form = state.ui.listingForm;
  const pricingRules = getPricingRules(state.user);
  const pricingValidation = form.creditPrice !== "" ? validateListingPrice(state.user, form.creditPrice) : null;
  const numericPrice = Number(form.creditPrice);
  const hasNumericPrice = Number.isFinite(numericPrice) && form.creditPrice !== "";
  const nearLimitThreshold = pricingRules.finalCap * 0.85;
  const priceTone = !hasNumericPrice
    ? "neutral"
    : numericPrice > pricingRules.finalCap
      ? "danger"
      : numericPrice >= nearLimitThreshold
        ? "warning"
        : "success";
  const priceInputClass =
    priceTone === "danger"
      ? "border-red-500/70 focus:border-red-500 focus:ring-red-500"
      : priceTone === "warning"
        ? "border-amber-500/70 focus:border-amber-500 focus:ring-amber-500"
        : priceTone === "success"
          ? "border-emerald-500/70 focus:border-emerald-500 focus:ring-emerald-500"
          : "";
  const hasTouched = Boolean(String(form.title || "").trim() || String(form.description || "").trim() || String(form.creditPrice || "").trim());
  const baseValidation = hasTouched ? validateListingForm(form) : "";
  const pricingMessage = pricingValidation?.message || "";
  const canSubmit = !state.loading.listing && !baseValidation && !pricingMessage;

  return `
    <section class="page-section animate-fade-in">
      <div class="max-w-2xl w-full mx-auto">

        <!-- Header -->
        <div class="mb-6">
          <h1 class="font-headline-md font-bold text-2xl text-primary mb-1">Create Listing</h1>
          <p class="text-sm text-on-surface-variant">Share your expertise or a resource with the SkillEX community.</p>
        </div>

        <div class="card">
          <form class="flex flex-col gap-6" data-form="listing">

            <!-- Title -->
            <div class="form-group">
              <label class="form-label" for="listing-title">Listing Title</label>
              <input
                class="input"
                id="listing-title"
                name="title"
                data-model="listingForm"
                value="${escapeHtml(form.title)}"
                placeholder="e.g. Python Tutoring for Beginners"
              >
            </div>

            <!-- Type Selection -->
            <div class="form-group">
              <label class="form-label">Listing Type</label>
              <div class="grid grid-cols-2 gap-3">
                <label class="relative cursor-pointer">
                  <input type="radio" name="listingType" value="skill" data-model="listingForm" class="peer sr-only" ${form.listingType === "skill" ? "checked" : ""}>
                  <div class="h-24 flex flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-muted peer-checked:border-brand peer-checked:bg-surface-soft text-on-surface-variant peer-checked:text-primary transition-all hover:border-outline">
                    <span class="material-symbols-outlined" style="font-size:22px;">psychology</span>
                    <span class="text-sm font-semibold">Skill</span>
                    <span class="text-[10px] font-medium opacity-70">Knowledge & expertise</span>
                  </div>
                </label>
                <label class="relative cursor-pointer">
                  <input type="radio" name="listingType" value="resource" data-model="listingForm" class="peer sr-only" ${form.listingType === "resource" ? "checked" : ""}>
                  <div class="h-24 flex flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-muted peer-checked:border-brand peer-checked:bg-surface-soft text-on-surface-variant peer-checked:text-primary transition-all hover:border-outline">
                    <span class="material-symbols-outlined" style="font-size:22px;">inventory_2</span>
                    <span class="text-sm font-semibold">Resource</span>
                    <span class="text-[10px] font-medium opacity-70">Materials & tools</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label" for="listing-description">Short Description</label>
              <textarea
                class="textarea"
                id="listing-description"
                name="description"
                data-model="listingForm"
                placeholder="Briefly describe what you are offering and who it's for…"
              >${escapeHtml(form.description)}</textarea>
            </div>

            <!-- Credit Price -->
            <div class="form-group">
              <label class="form-label" for="listing-price">Credit Price (CRD)</label>
              <div class="relative">
                <input
                  class="input pr-14 ${priceInputClass}"
                  id="listing-price"
                  name="creditPrice"
                  type="number"
                  min="${pricingRules.minPrice}"
                  max="${pricingRules.finalCap}"
                  step="1"
                  data-model="listingForm"
                  value="${escapeHtml(form.creditPrice)}"
                  placeholder="0"
                >
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">CRD</span>
              </div>
              <div class="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1" data-price-meta>
                <span class="material-symbols-outlined" style="font-size:14px;">info</span>
                Max: ${pricingRules.finalCap} CRD ${hasNumericPrice ? `· Remaining: ${Math.max(0, pricingRules.finalCap - numericPrice)} CRD` : ""} · Suggested: ${pricingRules.suggestedMin}–${pricingRules.suggestedMax} CRD
              </div>
              <div class="mt-2 text-xs font-semibold ${priceTone === "danger" ? "text-red-400" : priceTone === "warning" ? "text-amber-400" : priceTone === "success" ? "text-emerald-400" : "text-on-surface-variant"}" data-price-feedback>
                ${hasNumericPrice ? (priceTone === "danger" ? "Red: exceeds max allowed price." : priceTone === "warning" ? "Yellow: near your max allowed price." : "Green: valid price range.") : ""}
              </div>
            </div>

            <!-- Validation Messages -->
            ${pricingMessage ? `
              <div class="flex items-center gap-2.5 p-3 rounded-md text-sm" style="background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.2); color: var(--danger);">
                <span class="material-symbols-outlined shrink-0" style="font-size:18px;">warning</span>
                ${escapeHtml(pricingMessage)}
              </div>
            ` : ""}
            ${baseValidation && !pricingMessage ? `
              <div class="flex items-center gap-2.5 p-3 rounded-md text-sm" style="background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.2); color: var(--danger);">
                <span class="material-symbols-outlined shrink-0" style="font-size:18px;">error</span>
                ${escapeHtml(baseValidation)}
              </div>
            ` : ""}
            ${!pricingMessage && form.creditPrice !== "" ? `
              <div class="flex items-center gap-2.5 p-3 rounded-md text-sm" style="background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); color: var(--success);">
                <span class="material-symbols-outlined shrink-0" style="font-size:18px;">check_circle</span>
                Valid price for your current level.
              </div>
            ` : ""}

            <!-- Submit -->
            <div class="pt-2">
              <button
                class="btn-primary w-full h-11 text-base font-semibold"
                type="submit"
                ${canSubmit ? "" : "disabled"}
              >
                ${state.loading.listing
                  ? `<span class="material-symbols-outlined animate-spin" style="font-size:18px;">progress_activity</span> Creating…`
                  : `<span class="material-symbols-outlined" style="font-size:18px;">add_circle</span> Create Listing`}
              </button>
            </div>

          </form>
        </div>
      </div>
    </section>
  `;
}
