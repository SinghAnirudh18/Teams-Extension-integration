// ─────────────────────────────────────────────────────────────
// AI Chat Moderator — Content Script (SIMPLE VERSION)
// ─────────────────────────────────────────────────────────────
(() => {
  "use strict";

  const GRAMMAR = "BTech study group. Only study and academic discussions allowed.";

  let processing = false;
  let approved = false;

  // ── Show a small badge so we KNOW the extension loaded ─────
  const badge = document.createElement("div");
  badge.textContent = "🛡️ AI Mod ON";
  badge.style.cssText =
    "position:fixed;bottom:10px;right:10px;z-index:999999999;" +
    "background:#6366f1;color:white;padding:6px 14px;border-radius:20px;" +
    "font:bold 12px sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3);" +
    "cursor:pointer;opacity:0.9;transition:opacity .3s;";
  badge.title = "AI Moderator is active";
  document.body.appendChild(badge);

  console.log("[AI MOD] ✅ Loaded on", location.href);

  // ── INTERCEPT ENTER ────────────────────────────────────────
  document.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey) return;

    // If we just approved, let it through
    if (approved) {
      approved = false;
      return;
    }

    if (processing) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    // Find any editable element
    const el = document.activeElement;
    if (!el) return;
    if (!el.isContentEditable && el.tagName !== "TEXTAREA" && el.tagName !== "INPUT") return;

    const text = (el.innerText || el.value || "").trim();
    if (!text || text.length < 2) return;

    // BLOCK the send
    e.preventDefault();
    e.stopImmediatePropagation();

    processing = true;
    badge.textContent = "🛡️ Checking...";
    badge.style.background = "#f59e0b";

    console.log("[AI MOD] Checking:", text);

    try {
      const data = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "MODERATE_MESSAGE", payload: { message: text, grammar: GRAMMAR } },
          (resp) => {
            if (chrome.runtime.lastError) {
              resolve({ approved: false, code: "ERR", reason: chrome.runtime.lastError.message });
            } else {
              resolve(resp || { approved: false, code: "ERR", reason: "No response" });
            }
          }
        );
      });

      console.log("[AI MOD] Result:", data);

      if (data.approved) {
        // APPROVED — let it send
        console.log("[AI MOD] ✅ Approved");
        badge.textContent = "🛡️ ✅ Sent";
        badge.style.background = "#22c55e";
        processing = false;
        approved = true;

        // Re-fire Enter
        el.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter", code: "Enter", keyCode: 13, which: 13,
          bubbles: true, cancelable: true,
        }));
      } else {
        // BLOCKED
        console.log("[AI MOD] 🚫 Blocked:", data.code, data.reason);
        processing = false;
        showBlock(data.reason || "Message violates guidelines", data.code || "M400");
      }
    } catch (err) {
      console.error("[AI MOD] API error:", err);
      processing = false;
      showBlock("Cannot reach moderation server. Is it running on port 8080?", "ERR");
    }

    setTimeout(() => {
      badge.textContent = "🛡️ AI Mod ON";
      badge.style.background = "#6366f1";
    }, 3000);
  }, true);

  // ── Friendly info popup ─────────────────────────────────────
  function showBlock(reason, code) {
    badge.textContent = "🛡️ Not sent";
    badge.style.background = "#6366f1";

    // Remove old overlay
    const old = document.getElementById("ai-mod-block");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "ai-mod-block";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999998;" +
      "background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;" +
      "font-family:'Segoe UI',system-ui,sans-serif;animation:fadeIn .25s ease;";
    overlay.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }
      </style>
      <div style="background:#ffffff;border-radius:14px;padding:28px 32px;max-width:400px;width:90%;
        text-align:left;box-shadow:0 12px 40px rgba(0,0,0,.15);animation:slideUp .3s ease;">

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#eef2ff;display:flex;
            align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">ℹ️</div>
          <div>
            <div style="font-size:15px;font-weight:600;color:#1e293b;">This message cannot be sent</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">SentinelAI Moderation</div>
          </div>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:14px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
            Reason · <span style="color:#6366f1;font-weight:600;">${code}</span>
          </div>
          <div style="font-size:13px;color:#334155;line-height:1.5;">${reason}</div>
        </div>

        <div style="font-size:12px;color:#64748b;line-height:1.5;margin-bottom:18px;">
          💡 Please revise your message to match the group's study guidelines and try again.
        </div>

        <button onclick="this.closest('#ai-mod-block').remove()"
          style="width:100%;background:#6366f1;color:white;border:none;padding:10px;
          border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
          transition:background .2s;">
          Understood
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Auto-dismiss after 8 seconds
    setTimeout(() => { const el = document.getElementById("ai-mod-block"); if (el) el.remove(); }, 8000);
  }
})();
