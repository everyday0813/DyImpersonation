// Impersonation Extension - Main Logic
import { getContext, extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const MODULE_NAME = "impersonation";

const defaultSettings = {
    enabled: true,
    maxChars: 150,
    contextMessages: 50,
    apiEndpoint: "https://api.z.ai/api/coding/paas/v4/chat/completions",
    apiKey: "",
    apiModel: "glm-5"
};

let isGenerating = false;

function getSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {};
    if (Object.keys(extension_settings[MODULE_NAME]).length === 0) {
        Object.assign(extension_settings[MODULE_NAME], defaultSettings);
    }
    return extension_settings[MODULE_NAME];
}

async function loadSettings() {
    const s = getSettings();
    $("#impersonation-enabled").prop("checked", s.enabled);
    $("#impersonation-api-endpoint").val(s.apiEndpoint);
    $("#impersonation-api-key").val(s.apiKey);
    $("#impersonation-api-model").val(s.apiModel);
    $("#impersonation-max-chars").val(s.maxChars);
}

function saveSettings() {
    const s = getSettings();
    s.enabled = $("#impersonation-enabled").prop("checked");
    s.apiEndpoint = $("#impersonation-api-endpoint").val();
    s.apiKey = $("#impersonation-api-key").val();
    s.apiModel = $("#impersonation-api-model").val();
    s.maxChars = parseInt($("#impersonation-max-chars").val()) || 150;
    saveSettingsDebounced();
}

function getUserPersona() {
    const ctx = getContext();
    let p = null;
    if (ctx.chatMetadata && ctx.chatMetadata.persona) p = ctx.chatMetadata.persona;
    if (!p && ctx.extensionSettings && ctx.extensionSettings.persona) p = ctx.extensionSettings.persona;
    if (!p && ctx.userAvatar && ctx.userAvatar.description) p = ctx.userAvatar.description;
    return p || "A roleplay participant";
}

function getRecentChatHistory() {
    const ctx = getContext();
    const s = getSettings();
    const chat = ctx.chat || [];
    return chat.slice(-s.contextMessages).map(function(m) {
        return (m.is_user ? "User" : (m.name || "Char")) + ": " + (m.mes || "");
    }).join("\n\n");
}

function buildPrompt(input, persona, history) {
    const s = getSettings();
    let p = "Continue as USER. One sentence only.\n\nPersona:\n" + persona + "\n\nChat:\n" + history + "\n";
    if (input && input.trim()) {
        p += "\nPartial: \"" + input + "\"\nContinue this naturally.";
    } else {
        p += "\nWrite user's next action.";
    }
    p += "\n\nRules:\n- Max " + s.maxChars + " chars\n- Dialogue in quotes\n- Brief only";
    return p;
}

async function callAPI(prompt) {
    const s = getSettings();
    const res = await fetch(s.apiEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + s.apiKey
        },
        body: JSON.stringify({
            model: s.apiModel,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
            max_tokens: 2000,
            stream: false
        })
    });
    if (!res.ok) throw new Error("API " + res.status + ": " + await res.text());
    const d = await res.json();
    console.log("[Impersonation] Response:", d);
    console.log("[Impersonation] message:", d.choices?.[0]?.message);
    
    // Check for reasoning model format (e.g., DeepSeek-R1, GLM-5 thinking)
    if (d.choices && d.choices[0] && d.choices[0].message) {
        const msg = d.choices[0].message;
        // If content exists, use it
        if (msg.content) return msg.content;
        // If only reasoning_content exists, model didn't produce final answer
        // (thinking model ran out of tokens before completing)
        if (msg.reasoning_content) {
            console.warn("[Impersonation] Thinking model returned only reasoning, no final content.");
            console.warn("[Impersonation] Increase max_tokens or use non-thinking model.");
            toastr.warning("Thinking model needs more tokens. Increase max_tokens or use glm-4 instead.", "Impersonation");
            return null;
        }
    }
    // Legacy formats
    if (d.choices && d.choices[0] && d.choices[0].text) return d.choices[0].text;
    if (d.response) return d.response;
    if (d.content) return d.content;
    console.error("[Impersonation] No content found. Full response:", JSON.stringify(d, null, 2));
    throw new Error("Bad response format");
}

async function generate() {
    const s = getSettings();
    if (!s.enabled) return null;
    if (!s.apiKey) { toastr.warning("Set API key first", "Impersonation"); return null; }
    
    const prompt = buildPrompt($("#send_textarea").val() || "", getUserPersona(), getRecentChatHistory());
    console.log("[Impersonation] Generating...");
    
    try {
        let r = (await callAPI(prompt) || "").trim();
        if (r.length > s.maxChars) {
            const i = r.lastIndexOf(".", s.maxChars);
            r = r.substring(0, i > s.maxChars/2 ? i+1 : s.maxChars);
        }
        console.log("[Impersonation] Done:", r);
        return r;
    } catch (e) {
        console.error("[Impersonation] Error:", e);
        toastr.error(e.message, "Impersonation");
        return null;
    }
}

function makeButton() {
    const btn = $('<button id="impersonation-wand" title="Continue">W</button>');
    btn.on("click", async function(e) {
        e.preventDefault();
        if (isGenerating) return;
        isGenerating = true;
        btn.addClass("loading");
        try {
            const cont = await generate();
            if (cont) {
                const cur = $("#send_textarea").val() || "";
                $("#send_textarea").val(cur + (cur && !cur.endsWith(" ") ? " " : "") + cont);
                $("#send_textarea").trigger("input");
            }
        } finally {
            isGenerating = false;
            btn.removeClass("loading");
        }
    });
    return btn;
}

function injectButton() {
    if ($("#impersonation-wand").length) return;
    const sb = $("#send_but");
    if (!sb.length) { console.error("[Impersonation] No send button"); return; }
    makeButton().insertBefore(sb);
    console.log("[Impersonation] Button ready");
}

function injectSettings() {
    if ($("#impersonation-settings").length) return;
    const s = getSettings();
    $("#extensions_settings").append(
        '<div id="impersonation-settings" class="extension_container"><div class="inline-drawer-wide">' +
        '<h3>Impersonation</h3>' +
        '<label><input type="checkbox" id="impersonation-enabled"> Enable</label>' +
        '<label>Endpoint:<br><input type="text" id="impersonation-api-endpoint" class="text_pole wide100p"></label>' +
        '<label>Key:<br><input type="password" id="impersonation-api-key" class="text_pole wide100p"></label>' +
        '<label>Model:<br><input type="text" id="impersonation-api-model" class="text_pole wide100p"></label>' +
        '<label>Max:<br><input type="number" id="impersonation-max-chars" class="text_pole" min="50" max="500"></label>' +
        '</div></div>'
    );
    $("#impersonation-enabled").prop("checked", s.enabled).on("change", saveSettings);
    $("#impersonation-api-endpoint").val(s.apiEndpoint).on("input", saveSettings);
    $("#impersonation-api-key").val(s.apiKey).on("input", saveSettings);
    $("#impersonation-api-model").val(s.apiModel).on("input", saveSettings);
    $("#impersonation-max-chars").val(s.maxChars).on("input", saveSettings);
    console.log("[Impersonation] Settings ready");
}

jQuery(async function() {
    console.log("[Impersonation] Loading...");
    await loadSettings();
    injectButton();
    injectSettings();
    console.log("[Impersonation] Ready");
});
