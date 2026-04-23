import { escapeHtml, formatDateTime } from "../utils/helpers.js";

export function renderMeetingsView(state) {
  const availableUsers = state.users.filter((user) => (user.uid || user.id) !== state.user.uid);
  const form = state.ui.meetingForm;

  return `
    <section class="page-grid page-grid--two">
      <div class="stack">
        <div class="card surface">
          <div class="section-heading">
            <div class="stack" style="gap:6px">
              <span class="eyebrow">Realtime scheduling</span>
              <h2 class="title-lg">Meetings that stay tied to the conversation.</h2>
            </div>
          </div>

          ${state.meetings.length ? `
            <div class="meeting-list">
              ${state.meetings.map((meeting) => {
                const timestamp = meeting.scheduledAt || new Date(meeting.dt || 0).getTime() || 0;
                const link = meeting.link || "";
                const owner = meeting.createdBy || meeting.uid;

                return `
                  <article class="card meeting-item">
                    <div class="stack" style="gap:8px">
                      <strong>${escapeHtml(meeting.topic)}</strong>
                      <span class="muted">${formatDateTime(timestamp)}</span>
                      <span class="helper-text">${escapeHtml(link)}</span>
                    </div>
                    <div class="cluster">
                      <a class="btn btn--secondary" href="${escapeHtml(link)}" target="_blank" rel="noreferrer">Join</a>
                      ${owner === state.user.uid ? `
                        <button class="btn btn--danger" data-action="delete-meeting" data-id="${meeting.id}">Delete</button>
                      ` : ""}
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          ` : `
            <div class="empty-state">
              <div class="stack">
                <strong>No meetings scheduled</strong>
                <span>Create your first session from the panel on the right.</span>
              </div>
            </div>
          `}
        </div>
      </div>

      <aside class="stack">
        <div class="card surface surface--glow">
          <div class="stack" style="gap:8px">
            <span class="eyebrow">Create session</span>
            <h3 class="title-md">Schedule a meeting</h3>
            <p class="muted">Invite one person, add a link, and keep the session synced live in Firestore.</p>
          </div>

          <form class="form-grid" data-form="meeting" style="margin-top:24px">
            <div class="form-row">
              <label class="field-label" for="meeting-user">With</label>
              <select id="meeting-user" name="participantId" data-model="meetingForm">
                <option value="">Select a user</option>
                ${availableUsers.map((user) => `
                  <option value="${user.uid || user.id}" ${form.participantId === (user.uid || user.id) ? "selected" : ""}>${escapeHtml(user.name)}</option>
                `).join("")}
              </select>
            </div>

            <div class="form-row">
              <label class="field-label" for="meeting-topic">Topic</label>
              <input id="meeting-topic" name="topic" data-model="meetingForm" value="${escapeHtml(form.topic)}" placeholder="Marketplace handoff">
            </div>

            <div class="form-row">
              <label class="field-label" for="meeting-date">Date and time</label>
              <input id="meeting-date" type="datetime-local" name="scheduledAt" data-model="meetingForm" value="${escapeHtml(form.scheduledAt)}">
            </div>

            <div class="form-row">
              <label class="field-label" for="meeting-link">Meeting link</label>
              <input id="meeting-link" name="link" data-model="meetingForm" value="${escapeHtml(form.link)}" placeholder="https://meet.google.com/...">
            </div>

            <button class="btn btn--primary" type="submit" ${state.loading.meeting ? "disabled" : ""}>
              ${state.loading.meeting ? "Scheduling..." : "Schedule meeting"}
            </button>
          </form>
        </div>
      </aside>
    </section>
  `;
}
