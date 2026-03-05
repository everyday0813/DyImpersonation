// Impersonation Extension - Main Logic
// Generates user-style continuations for roleplay, one sentence at a time

import { getContext, extension_settings, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// ============================================
// Constants & Settings
// ============================================

const MODULE_NAME = "impersonation";
const EXTENSION_PATH = `scripts/extensions/third-party/${MODULE_NAME}`;

const defaultSettings = {
    enabled: true,
    maxChars: 150,        // Max characters per generation
    contextMessages: 50,  // Number of recent messages to include
    showLoading: true
};

let isGenerating = false;

// ============================================
// Settings Management
// ============================================

function getSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {};
    if (Object.keys(extension_settings[MODULE_NAME]).length === 0) {
        Object.assign(extension_settings[MODULE_NAME], defaultSettings);
    }
    return extension_settings[MODULE_NAME];
}

async function loadSettings() {
    const settings = getSettings();
    // Apply settings to UI if needed
    $("#impersonation-enabled").prop("checked", settings.enabled);
}

// ============================================
// Context Gathering
// ============================================

/**
 * Get the user's chat-specific persona
 */
function getUserPersona() {
    const context = getContext();
    
    // Try to get chat-specific persona
    // SillyTavern stores persona in various places depending on version
    let persona = null;
    
    // Method 1: Check chat metadata for persona
    if (context.chatMetadata?.persona) {
        persona = context.chatMetadata.persona;
    }
    
    // Method 2: Check for active persona from global settings
    if (!persona && context.extensionSettings?.persona) {
        persona = context.extensionSettings.persona;
    }
    
    // Method 3: Use default user avatar/description
    if (!persona) {
        const userAvatar = context.userAvatar;
        if (userAvatar?.description) {
            persona = userAvatar.description;
        }
    }
    
    return persona || "A roleplay participant";
}

/**
 * Get recent chat history formatted for context
 */
function getRecentChatHistory() {
    const context = getContext();
    const settings = getSettings();
    const chat = context.chat || [];
    
    // Get last N messages
    const recentMessages = chat.slice(-settings.contextMessages);
    
    // Format for prompt
    return recentMessages.map(msg => {
        const name = msg.is_user ? "User" : (msg.name || "Character");
        const text = msg.mes || "";
        return `${name}: ${text}`;
    }).join("\n\n");
}

/**
 * Detect if there's an unclosed quote in the text
 */
function detectUnclosedQuote(text) {
    if (!text) return { hasUnclosedQuote: false, quoteChar: null };
    
    const quoteChars = ['"', '"', '"', "'", "'", "'"];
    let result = { hasUnclosedQuote: false, quoteChar: null, lastQuoteIndex: -1 };
    
    for (const char of quoteChars) {
        const count = (text.match(new RegExp(escapeRegex(char), "g")) || []).length;
        if (count % 2 !== 0) {
            // Found odd number of this quote char
            result.hasUnclosedQuote = true;
            result.quoteChar = char;
            result.lastQuoteIndex = text.lastIndexOf(char);
            break;
        }
    }
    
    return result;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// Prompt Building
// ============================================

function buildContinuationPrompt(currentInput, persona, chatHistory) {
    const settings = getSettings();
    const quoteInfo = detectUnclosedQuote(currentInput);
    
    let prompt = `You are continuing a roleplay as the USER character. Write the NEXT sentence only.

USER PERSONA:
${persona}

RECENT CONVERSATION:
${chatHistory}
`;

    if (currentInput && currentInput.trim()) {
        prompt += `\nUSER'S PARTIAL INPUT:
"${currentInput}"
`;
        
        if (quoteInfo.hasUnclosedQuote) {
            prompt += `
IMPORTANT: The user has an unclosed ${quoteInfo.quoteChar} quote. Continue the dialogue naturally and close the quote when appropriate. Also add brief action/narrative if fitting.
`;
        } else {
            prompt += `
Continue naturally from this input. Add brief action/narrative if fitting.
`;
        }
    } else {
        prompt += `
Continue the roleplay as the user. Write their next action or dialogue.
`;
    }

    prompt += `
OUTPUT RULES:
- Output ONLY the continuation text, nothing else
- Max ${settings.maxChars} characters
- Dialogue goes inside quotation marks
- Actions/narrative are plain text (no asterisks needed)
- Natural, brief continuation only
`;

    return prompt;
}

// ============================================
// Generation
// ============================================

async function generateContinuation() {
    const context = getContext();
    const settings = getSettings();
    
    if (!settings.enabled) {
        console.log("[Impersonation] Extension disabled");
        return null;
    }
    
    // Gather context
    const persona = getUserPersona();
    const chatHistory = getRecentChatHistory();
    const currentInput = $("#send_textarea").val() || "";
    
    // Build prompt
    const prompt = buildContinuationPrompt(currentInput, persona, chatHistory);
    
    console.log("[Impersonation] Generating continuation...");
    
    try {
        // Use generateQuietPrompt for context-aware generation
        const result = await context.generateQuietPrompt({
            quietPrompt: prompt,
        });
        
        // Clean up the result
        let continuation = (result || "").trim();
        
        // Limit length
        if (continuation.length > settings.maxChars) {
            // Try to cut at a sentence boundary
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
        console.error("[Impersonation] Generation failed:", error);
        toastr.error("Failed to generate continuation", "Impersonation");
        return null;
    }
}

// ============================================
// UI Components
// ============================================

function createWandButton() {
    const button = $(`
        <button id="impersonation-wand" type="button" title="Generate continuation">
            🪄
        </button>
    `);
    
    button.on("click", async (e) => {
        e.preventDefault();
        
        if (isGenerating) {
            console.log("[Impersonation] Already generating, ignoring click");
            return;
        }
        
        // Set loading state
        isGenerating = true;
        button.addClass("loading");
        
        try {
            const continuation = await generateContinuation();
            
            if (continuation) {
                // Get current input
                const currentInput = $("#send_textarea").val() || "";
                
                // Add space if needed
                let separator = "";
                if (currentInput && !currentInput.endsWith(" ") && !currentInput.endsWith("\n")) {
                    separator = " ";
                }
                
                // Append to input box
                $("#send_textarea").val(currentInput + separator + continuation);
                
                // Trigger input event for any listeners
                $("#send_textarea").trigger("input");
            }
        } finally {
            // Reset loading state
            isGenerating = false;
            button.removeClass("loading");
        }
    });
    
    return button;
}

function injectWandButton() {
    // Check if already injected
    if ($("#impersonation-wand").length > 0) {
        console.log("[Impersonation] Button already exists");
        return;
    }
    
    // Find the send button container
    const sendButton = $("#send_but");
    
    if (sendButton.length === 0) {
        console.error("[Impersonation] Send button not found");
        return;
    }
    
    // Create and inject wand button
    const wandButton = createWandButton();
    wandButton.insertBefore(sendButton);
    
    console.log("[Impersonation] Wand button injected");
}

// ============================================
// Initialization
// ============================================

jQuery(async () => {
    console.log("[Impersonation] Loading extension...");
    
    // Load settings
    await loadSettings();
    
    // Inject UI
    injectWandButton();
    
    console.log("[Impersonation] Extension loaded successfully");
});
