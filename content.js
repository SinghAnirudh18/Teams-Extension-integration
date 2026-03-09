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

  // ── Block popup ────────────────────────────────────────────
  function showBlock(reason, code) {
    badge.textContent = "🛡️ 🚫 Blocked";
    badge.style.background = "#ef4444";

    // Remove old overlay
    const old = document.getElementById("ai-mod-block");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "ai-mod-block";
    overlay.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999998;" +
      "background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;" +
      "font-family:sans-serif;";
    overlay.innerHTML = `
      <div style="background:#1a1a2e;border:2px solid #ef4444;border-radius:16px;
        padding:30px;max-width:420px;width:90%;color:white;text-align:center;
        box-shadow:0 20px 60px rgba(0,0,0,.5);">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <h2 style="margin:0 0 8px;color:#f87171;font-size:20px;">Message Blocked</h2>
        <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;">Code: ${code}</p>
        <p style="margin:0 0 20px;color:#e5e7eb;font-size:14px;line-height:1.5;">${reason}</p>
        <button onclick="this.parentElement.parentElement.remove()"
          style="background:#ef4444;color:white;border:none;padding:10px 30px;
          border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
          OK, Got It
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Auto-dismiss after 6 seconds
    setTimeout(() => overlay.remove(), 6000);
  }
})();
