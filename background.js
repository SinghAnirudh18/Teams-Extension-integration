// ─────────────────────────────────────────────────────────────
// AI Chat Moderator — Background Service Worker
// Handles moderation API calls and stores settings/logs
// ─────────────────────────────────────────────────────────────

const DEFAULT_API_URL = "http://localhost:8080";

// ── Moderation code lookup table ────────────────────────────
const MODERATION_RULES = {
  M100: "Respectful Communication",
  M101: "Personal or Sensitive Information",
  M102: "Political or Religious Discussions",
  M103: "Promotions or Advertising",
  M104: "Off Topic Discussion",
  M105: "Financial or Gambling Content",
  M106: "Illegal or Unsafe Content",
  M107: "Spam or Low Quality Message",
  M108: "AI Moderation Feedback",
  M109: "Moderation Policy Enforcement",
  M200: "Message Approved",
  M400: "Message Rejected",
};

// ── Listen for messages from content script ─────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "MODERATE_MESSAGE") {
    handleModeration(request.payload)
      .then(sendResponse)
      .catch((err) => {
        console.error("[AI Moderator] API error:", err);
        // BLOCK by default when API fails
        sendResponse({
          approved: false,
          code: "M400",
          ruleName: "API Error",
          reason: "Moderation server error: " + err.message,
        });
      });
    return true; // keep channel open for async response
  }

  if (request.type === "GET_SETTINGS") {
    chrome.storage.sync.get(
      { apiUrl: DEFAULT_API_URL, enabled: true },
      (settings) => sendResponse(settings)
    );
    return true;
  }

  if (request.type === "SAVE_SETTINGS") {
    chrome.storage.sync.set(request.payload, () =>
      sendResponse({ success: true })
    );
    return true;
  }

  if (request.type === "GET_LOGS") {
    chrome.storage.local.get({ moderationLogs: [] }, (data) =>
      sendResponse(data.moderationLogs)
    );
    return true;
  }
});

// ── Core moderation API handler ─────────────────────────────
async function handleModeration({ message, grammar }) {
  const { apiUrl, enabled } = await getSettings();

  if (!enabled) {
    return { approved: true, bypassed: true };
  }

  const response = await fetch(`${apiUrl}/moderate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, grammar }),
  });

  if (!response.ok) {
    throw new Error(`API responded with status ${response.status}`);
  }

  const data = await response.json();
  const code = data.code || "M400";
  const reason = data.reason || "Unknown moderation response";
  const ruleName = MODERATION_RULES[code] || "Unknown Rule";
  const approved = code === "M200";

  // Log event
  await logModerationEvent({
    timestamp: Date.now(),
    message: message.substring(0, 80) + (message.length > 80 ? "…" : ""),
    code,
    ruleName,
    reason,
    approved,
  });

  return { approved, code, ruleName, reason };
}

// ── Helpers ─────────────────────────────────────────────────
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { apiUrl: DEFAULT_API_URL, enabled: true },
      resolve
    );
  });
}

async function logModerationEvent(event) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ moderationLogs: [] }, (data) => {
      const logs = [event, ...data.moderationLogs].slice(0, 50);
      chrome.storage.local.set({ moderationLogs: logs }, resolve);
    });
  });
}
