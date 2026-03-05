# AGENTS.md - Coding Agent Guidelines

## Project Overview

This is a **SillyTavern Extension** project. Extensions are browser-side JavaScript modules that run inside SillyTavern's web interface. There is no build step - files are loaded directly by SillyTavern.

## Build/Lint/Test Commands

```bash
# No build required - extensions load directly
# No package.json - dependencies provided by SillyTavern

# Testing: Manual testing in SillyTavern
# 1. Copy extension folder to: SillyTavern/data/<username>/extensions/<extension-name>/
# 2. Restart SillyTavern or refresh browser
# 3. Enable in Extensions Panel → Manage Extensions

# Linting: Use editor/IDE JavaScript linting (ESLint recommended)
# Type checking: Not configured - standard JavaScript
```

## Project Structure

```
impersonation/
├── manifest.json      # Extension metadata (required)
├── index.js           # Main entry point (required)
├── style.css          # Styles (optional)
└── settings.html      # Settings UI (optional)
```

## Code Style Guidelines

### Imports

```javascript
// SillyTavern APIs - use relative paths from extensions folder
import { getContext, extension_settings, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Order: external APIs first, then local modules (if any)
```

### Constants & Configuration

```javascript
// Module constants at top - SCREAMING_SNAKE_CASE
const MODULE_NAME = "impersonation";
const EXTENSION_PATH = `scripts/extensions/third-party/${MODULE_NAME}`;

// Default settings object
const defaultSettings = {
    enabled: true,
    maxChars: 100,
    contextMessages: 20
};
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Constants | SCREAMING_SNAKE_CASE | `MODULE_NAME`, `MAX_CHARS` |
| Functions | camelCase | `getUserPersona()`, `buildPrompt()` |
| Private functions | _leadingUnderscore | `_formatMessage()` |
| Event handlers | on[Action] | `onWandClick()`, `onSettingChange()` |
| Boolean variables | is/has prefix | `isGenerating`, `hasUnclosedQuote` |
| DOM element IDs | kebab-case | `#impersonation-wand` |

### Section Headers

Organize code with clear section headers:

```javascript
// ============ Settings Management ============

function getSettings() { ... }

// ============ Context Gathering ============

function getUserPersona() { ... }

// ============ UI Functions ============

function createWandButton() { ... }
```

### Functions

```javascript
/**
 * Brief description of what the function does.
 * @param {string} paramName - Parameter description
 * @returns {Promise<string>} Return value description
 */
async function functionName(paramName) {
    // Early return for validation
    if (!paramName) {
        return "";
    }
    
    try {
        const result = await asyncOperation();
        return result;
    } catch (error) {
        console.error(`[${MODULE_NAME}] Error:`, error);
        toastr.error("User-friendly error message");
        return "";
    }
}
```

### Error Handling

```javascript
// Always wrap async operations in try-catch
try {
    const result = await riskyOperation();
} catch (error) {
    console.error(`[${MODULE_NAME}] Operation failed:`, error);
    toastr.error("Something went wrong. Please try again.");
}

// Use toastr for user notifications (built into SillyTavern)
toastr.success("Operation completed");
toastr.error("Failed to generate");
toastr.info("Processing...");
toastr.warning("Check your settings");
```

### Logging

```javascript
// Always prefix console logs with module name
console.log(`[${MODULE_NAME}] Starting generation`);
console.warn(`[${MODULE_NAME}] No persona found`);
console.error(`[${MODULE_NAME}] API error:`, error);
```

### Async Patterns

```javascript
// Use async/await - avoid raw promises
// BAD
getContext().generateQuietPrompt({ quietPrompt: text }).then(result => { ... });

// GOOD
const result = await getContext().generateQuietPrompt({ quietPrompt: text });

// Prevent race conditions with loading flags
let isGenerating = false;

async function generate() {
    if (isGenerating) return;
    isGenerating = true;
    
    try {
        // ... generation logic
    } finally {
        isGenerating = false;
    }
}
```

### DOM Manipulation

```javascript
// Use jQuery (built into SillyTavern)
const $button = $("<button>", {
    id: "impersonation-wand",
    text: "🪄",
    title: "Generate continuation"
});

// Insert relative to existing elements
$button.insertBefore("#send_but");

// Event handlers
$button.on("click", onWandClick);

// Access SillyTavern elements
const $input = $("#send_textarea");  // Input box
const $sendBtn = $("#send_but");     // Send button
```

### Settings Management

```javascript
function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }
    if (Object.keys(extension_settings[MODULE_NAME]).length === 0) {
        Object.assign(extension_settings[MODULE_NAME], defaultSettings);
    }
    return extension_settings[MODULE_NAME];
}

// Save changes with debounce
function onSettingChange(event) {
    const settings = getSettings();
    settings.someOption = $(event.target).val();
    saveSettingsDebounced();
}
```

## SillyTavern API Reference

### Key Functions

```javascript
const context = getContext();

// Chat data
context.chat           // Array of message objects
context.characters     // Character list
context.characterId    // Current character index
context.chatMetadata   // Per-chat persistent data

// Generation
await context.generateQuietPrompt({ quietPrompt: "text" });
await context.generateRaw({ prompt: "text", systemPrompt: "system" });

// Settings
extension_settings[MODULE_NAME]  // Persistent storage
saveSettingsDebounced()          // Save to disk
```

### Available Libraries

Via `SillyTavern.libs`:
- `lodash` - Utility functions
- `DOMPurify` - HTML sanitization
- `moment` - Date handling
- `showdown` - Markdown parser
- `Fuse` - Fuzzy search

## Installation

1. Copy extension folder to: `SillyTavern/data/<username>/extensions/`
2. Restart SillyTavern
3. Enable in Extensions → Manage Extensions

## Common Pitfalls

- **Don't** use `as any` or `@ts-ignore` (TypeScript not configured, but good practice)
- **Don't** store API keys in `extension_settings` (visible to other extensions)
- **Don't** block the UI thread - use async operations
- **Do** sanitize user input with `DOMPurify.sanitize()`
- **Do** clean up event listeners when extension is disabled
- **Do** handle edge cases (empty chat, missing persona, API failures)
