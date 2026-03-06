// Impersonation Extension - Main Logic
// Generates user-style continuations for roleplay

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
    const settings = getSettings();
    $("#impersonation-enabled").prop("checked", settings.enabled);
    $("#impersonation-api-endpoint").val(settings.apiEndpoint);
    $("#impersonation-api-key").val(settings.apiKey);
    $("#impersonation-api-model").val(settings.apiModel);
    $("#impersonation-max-chars").val(settings.maxChars);
}

function saveSettings() {
    const settings = getSettings();
    settings.enabled = $("#impersonation-enabled").prop("checked");
    settings.apiEndpoint = $("#impersonation-api-endpoint").val();
    settings.apiKey = $("#impersonation-api-key").val();
    settings.apiModel = $("#impersonation-api-model").val();
    settings.maxChars = parseInt($("#impersonation-max-chars").val()) || 150;
    saveSettingsDebounced();
    console.log("[Impersonation] Settings saved");
}

function getUserPersona() {
    const context = getContext();
    let persona = null;
    
    if (context.chatMetadata && context.chatMetadata.persona) {
        persona = context.chatMetadata.persona;
    }
    
    if (!persona && context.extensionSettings && context.extensionSettings.persona) {
        persona = context.extensionSettings.persona;
    }
    
    if (!persona) {
        const userAvatar = context.userAvatar;
        if (userAvatar && userAvatar.description) {
            persona = userAvatar.description;
        }
    }
    
    return persona || "A roleplay participant";
}

function getRecentChatHistory() {
    const context = getContext();
    const settings = getSettings();
    const chat = context.chat || [];
    const recentMessages = chat.slice(-settings.contextMessages);
    
    return recentMessages.map(function(msg) {
        const name = msg.is_user ? "User" : (msg.name || "Character");
        const text = msg.mes || "";
        return name + ": " + text;
    }).join("\n\n");
}

function detectUnclosedQuote(text) {
    if (!text) return { hasUnclosedQuote: false, quoteChar: null };
    const quoteChars = ['"', '"', '"', "'", "'", "'"];
    const result = { hasUnclosedQuote: false, quoteChar: null, lastQuoteIndex: -1 };
    
    for (let i = 0; i < quoteChars.length; i++) {
        const char = quoteChars[i];
        const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const count = (text.match(new RegExp(escaped, "g")) || []).length;
        if (count % 2 !== 0) {
            result.hasUnclosedQuote = true;
            result.quoteChar = char;
            result.lastQuoteIndex = text.lastIndexOf(char);
            break;
        }
    }
    return result;
}

function buildContinuationPrompt(currentInput, persona, chatHistory) {
    const settings = getSettings();
    const quoteInfo = detectUnclosedQuote(currentInput);
    
    let prompt = "You are continuing a roleplay as the USER character. Write the NEXT sentence only.\n\nUSER PERSONA:\n" + persona + "\n\nRECENT CONVERSATION:\n" + chatHistory + "\n";
    
    if (currentInput && currentInput.trim()) {
        prompt += "\nUSER'S PARTIAL INPUT:\n\"" + currentInput + "\"\n";
        if (quoteInfo.hasUnclosedQuote) {
            prompt += "\nIMPORTANT: Continue the dialogue naturally and close the quote when appropriate.\n";
        } else {
            prompt += "\nContinue naturally from this input.\n";
        }
    } else {
        prompt += "\nContinue the roleplay as the user.\n";
    }
    
    prompt += "\nOUTPUT RULES:\n- Output ONLY the continuation text\n- Max " + settings.maxChars + " characters\n- Dialogue inside quotes\n- Natural, brief continuation\n";
    
    return prompt;
}

async function callCustomAPI(prompt) {
    const settings = getSettings();
    
    const response = await fetch(settings.apiEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + settings.apiKey
        },
        body: JSON.stringify({
            model: settings.apiModel,
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: 0.8,
            max_tokens: 500,
            stream: false
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error("API error " + response.status + ": " + errorText);
    }
    
    const data = await response.json();
    console.log("[Impersonation] API Response:", data);
    
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        return data.choices[0].message.content;
    }
    if (data.choices && data.choices[0] && data.choices[0].text) {
        return data.choices[0].text;
    }
    if (data.response) {
        return data.response;
    }
    if (data.content) {
        return data.content;
    }
    
    throw new Error("Unexpected API response format");
}

async function generateContinuation() {
    const settings = getSettings();
    
    if (!settings.enabled) {
        console.log("[Impersonation] Extension disabled");
        return null;
    }
    
    if (!settings.apiKey) {
        toastr.warning("Please configure API key in settings", "Impersonation");
        return null;
    }
    
    const persona = getUserPersona();
    const chatHistory = getRecentChatHistory();
    const currentInput = $("#send_textarea").val() || "";
    const prompt = buildContinuationPrompt(currentInput, persona, chatHistory);
    
    console.log("[Impersonation] Generating...");
    
    try {
        const result = await callCustomAPI(prompt);
        let continuation = (result || "").trim();
        
        if (continuation.length > settings.maxChars) {
            const cutPoint = continuation.lastIndexOf(".", settings.maxChars);
            if (cutPoint > settings.maxChars / 2) {
                continuation = continuation.substring(0, cutPoint + 1);
            } else {
                continuation = continuation.substring(0, settings.maxChars);
            }
        }
        
        console.log("[Impersonation] Generated:", continuation);
        return continuation;
    } catch (error) {
        console.error("[Impersonation] Error:", error);
        toastr.error("Failed: " + error.message, "Impersonation");
        return null;
    }
}

function createWandButton() {
    const button = $('<button id="impersonation-wand" title="Generate continuation">Wand</button>');
    
    button.on("click", async function(e) {
        e.preventDefault();
        if (isGenerating) return;
        isGenerating = true;
        button.addClass("loading");
        
        try {
            const continuation = await generateContinuation();
            if (continuation) {
                const currentInput = $("#send_textarea").val() || "";
                const separator = (currentInput && !currentInput.endsWith(" ")) ? " " : "";
                $("#send_textarea").val(currentInput + separator + continuation);
                $("#send_textarea").trigger("input");
            }
        } finally {
            isGenerating = false;
            button.removeClass("loading");
        }
    });
    
    return button;
}

function injectWandButton() {
    if ($("#impersonation-wand").length > 0) return;
    const sendButton = $("#send_but");
    if (sendButton.length === 0) {
        console.error("[Impersonation] Send button not found");
        return;
    }
    const wandButton = createWandButton();
    wandButton.insertBefore(sendButton);
    console.log("[Impersonation] Wand button injected");
}

function injectSettingsPanel() {
    if ($("#impersonation-settings").length > 0) return;
    
    const settings = getSettings();
    const html = '<div id="impersonation-settings" class="extension_container"><div class="inline-drawer-wide"><h3>Impersonation Settings</h3><label><input type="checkbox" id="impersonation-enabled"> Enable</label><label>API Endpoint:<br><input type="text" id="impersonation-api-endpoint" class="text_pole wide100p"></label><label>API Key:<br><input type="password" id="impersonation-api-key" class="text_pole wide100p"></label><label>Model:<br><input type="text" id="impersonation-api-model" class="text_pole wide100p"></label><label>Max Chars:<br><input type="number" id="impersonation-max-chars" class="text_pole" min="50" max="500"></label></div></div>';
    
    $("#extensions_settings").append(html);
    
    $("#impersonation-enabled").prop("checked", settings.enabled);
    $("#impersonation-api-endpoint").val(settings.apiEndpoint);
    $("#impersonation-api-key").val(settings.apiKey);
    $("#impersonation-api-model").val(settings.apiModel);
    $("#impersonation-max-chars").val(settings.maxChars);
    
    $("#impersonation-enabled").on("change", saveSettings);
    $("#impersonation-api-endpoint").on("input", saveSettings);
    $("#impersonation-api-key").on("input", saveSettings);
    $("#impersonation-api-model").on("input", saveSettings);
    $("#impersonation-max-chars").on("input", saveSettings);
    
    console.log("[Impersonation] Settings panel injected");
}

jQuery(async function() {
    console.log("[Impersonation] Loading extension...");
    await loadSettings();
    injectWandButton();
    injectSettingsPanel();
    console.log("[Impersonation] Loaded successfully");
});
