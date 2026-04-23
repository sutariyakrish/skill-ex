let host;
let currentModal = null;

function renderModal() {
  if (!host) {
    return;
  }

  if (!currentModal) {
    host.classList.remove("is-open");
    host.innerHTML = "";
    document.body.style.overflow = "";
    return;
  }

  host.classList.add("is-open");
  document.body.style.overflow = "hidden";
  const confirmTone = (currentModal.confirmTone || "btn-primary").replace("btn--", "btn-");
  const icon = currentModal.icon || "celebration";
  const showIcon = currentModal.showIcon !== false;
  
  host.innerHTML = `
    <div class="modal">
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          ${showIcon ? `
            <div class="w-12 h-12 rounded-full flex items-center justify-center" style="background: rgba(62, 207, 142, 0.16); color: var(--accent);">
              <span class="material-symbols-outlined">${icon}</span>
            </div>
          ` : ""}
          <h3 class="text-xl font-bold text-primary">${currentModal.title}</h3>
          <p class="text-sm text-on-surface-variant leading-relaxed">${currentModal.body}</p>
        </div>
        <div class="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/30 mt-2">
          <button class="btn-secondary border-transparent hover:border-outline-variant/50" data-modal-action="cancel">${currentModal.cancelLabel || "Cancel"}</button>
          <button class="${confirmTone}" data-modal-action="confirm">${currentModal.confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </div>
  `;
}

export function initModalHost() {
  if (host) {
    return;
  }

  host = document.createElement("div");
  host.className = "modal-host";
  document.body.append(host);

  host.addEventListener("click", async (event) => {
    if (event.target === host || event.target.closest('[data-modal-action="cancel"]')) {
      closeModal();
      return;
    }

    if (event.target.closest('[data-modal-action="confirm"]')) {
      const action = currentModal?.onConfirm;
      closeModal();

      if (action) {
        await action();
      }
    }
  });
}

export function openModal(options) {
  currentModal = options;
  renderModal();
}

export function closeModal() {
  currentModal = null;
  renderModal();
}
