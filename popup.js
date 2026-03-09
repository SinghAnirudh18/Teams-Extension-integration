// ─────────────────────────────────────────────────────────────
// AI Chat Moderator — Popup Script
// Settings management, stats display, and activity log
// ─────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const apiUrlInput = document.getElementById("api-url-input");
  const btnSave = document.getElementById("btn-save");
  const saveFeedback = document.getElementById("save-feedback");
  const toggleEnabled = document.getElementById("toggle-enabled");
  const statusBadge = document.getElementById("status-badge");
  const statTotal = document.getElementById("stat-total");
  const statBlocked = document.getElementById("stat-blocked");
  const statApproved = document.getElementById("stat-approved");
  const logList = document.getElementById("log-list");

  // ── Load settings ─────────────────────────────────────────
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
    if (chrome.runtime.lastError) return;
    apiUrlInput.value = settings.apiUrl || "http://localhost:8080";
    toggleEnabled.checked = settings.enabled !== false;
    updateStatusBadge(toggleEnabled.checked);
  });

  // ── Save settings ─────────────────────────────────────────
  btnSave.addEventListener("click", () => {
    const url = apiUrlInput.value.trim();
    if (!url) {
      showFeedback("Please enter a valid URL", "error");
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "SAVE_SETTINGS",
        payload: { apiUrl: url },
      },
      () => {
        showFeedback("✓ Saved successfully", "success");
      }
    );
  });

  // ── Toggle moderation ─────────────────────────────────────
  toggleEnabled.addEventListener("change", () => {
    const enabled = toggleEnabled.checked;
    chrome.runtime.sendMessage({
      type: "SAVE_SETTINGS",
      payload: { enabled },
    });
    updateStatusBadge(enabled);
  });

  // ── Load logs ─────────────────────────────────────────────
  chrome.runtime.sendMessage({ type: "GET_LOGS" }, (logs) => {
    if (chrome.runtime.lastError || !logs) return;
    renderLogs(logs);
    renderStats(logs);
  });

  // ── Helpers ───────────────────────────────────────────────
  function updateStatusBadge(active) {
    statusBadge.className = active
      ? "status-badge status-active"
      : "status-badge status-inactive";
    statusBadge.querySelector(".status-text").textContent = active
      ? "Active"
      : "Paused";
  }

  function showFeedback(text, type) {
    saveFeedback.textContent = text;
    saveFeedback.className = `input-hint feedback-${type}`;
    setTimeout(() => {
      saveFeedback.textContent = "";
      saveFeedback.className = "input-hint";
    }, 2500);
  }

  function renderStats(logs) {
    const total = logs.length;
    const blocked = logs.filter((l) => !l.approved).length;
    const approved = logs.filter((l) => l.approved).length;
    statTotal.textContent = total;
    statBlocked.textContent = blocked;
    statApproved.textContent = approved;
  }

  function renderLogs(logs) {
    if (!logs.length) {
      logList.innerHTML =
        '<div class="log-empty">No moderation events yet.</div>';
      return;
    }

    logList.innerHTML = logs
      .slice(0, 10)
      .map((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const statusClass = log.approved ? "log-approved" : "log-blocked";
        const statusIcon = log.approved ? "✅" : "⛔";
        return `
        <div class="log-item ${statusClass}">
          <div class="log-item-header">
            <span class="log-status">${statusIcon}</span>
            <span class="log-code">${escapeHtml(log.code)}</span>
            <span class="log-time">${time}</span>
          </div>
          <div class="log-message">${escapeHtml(log.message)}</div>
          ${
            !log.approved
              ? `<div class="log-reason">${escapeHtml(log.reason)}</div>`
              : ""
          }
        </div>`;
      })
      .join("");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }
});
