# SillyTavern Extension Development Guide

SillyTavern supports **two types of extensions**:

---

## 1. UI Extensions (Browser-side)

Run in browser with DOM/JS API access and SillyTavern's internal API.

### File Structure

```
my-extension/
├── manifest.json      # Required - metadata
├── index.js           # Required - main entry
├── style.css          # Optional
└── settings.html      # Optional
```

### manifest.json

```json
{
    "display_name": "My Extension",
    "js": "index.js",
    "css": "style.css",
    "author": "YourName",
    "version": "1.0.0",
    "loading_order": 1,
    "generate_interceptor": "myInterceptorFunction"
}
```

**Key Manifest Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `display_name` | Yes | Shown in "Manage Extensions" menu |
| `js` | Yes | Main JavaScript file |
| `css` | No | Optional stylesheet |
| `loading_order` | No | Higher = loads later (affects interceptor order) |
| `generate_interceptor` | No | Global function name called on text generation |
| `dependencies` | No | Array of other extension folder names this depends on |

### Basic Extension Template

```javascript
// index.js
import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const MODULE = "my-extension";
const EXTENSION_PATH = `scripts/extensions/third-party/${MODULE}`;

const defaultSettings = {
    enabled: false,
    option1: 'default'
};

// Load settings into UI
function loadSettings() {
    extension_settings[MODULE] = extension_settings[MODULE] || {};
    if (Object.keys(extension_settings[MODULE]).length === 0) {
        Object.assign(extension_settings[MODULE], defaultSettings);
    }
    $("#my_setting").prop("checked", extension_settings[MODULE].enabled);
}

// Handle setting changes
function onSettingChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[MODULE].enabled = value;
    saveSettingsDebounced();
}

// Initialize
jQuery(async () => {
    const settingsHtml = await $.get(`${EXTENSION_PATH}/settings.html`);
    $("#extensions_settings").append(settingsHtml);
    
    $("#my_setting").on("input", onSettingChange);
    loadSettings();
});
```

### Core API: getContext()

```javascript
const context = getContext();

// Chat data
context.chat;              // Chat log - MUTABLE array
context.characters;        // Character list
context.characterId;       // Current character index
context.groups;            // Group list
context.groupId;           // Current group ID
context.chatMetadata;      // Per-chat metadata
context.extensionSettings; // Persistent settings

// Events
context.eventSource;
context.event_types;
```

### Available Events

```javascript
const { eventSource, event_types } = getContext();

eventSource.on(event_types.MESSAGE_RECEIVED, handleIncomingMessage);
eventSource.on(event_types.MESSAGE_SENT, handleUserMessage);
eventSource.on(event_types.CHAT_CHANGED, handleChatSwitch);
eventSource.on(event_types.GENERATION_ENDED, handleGenerationComplete);
```

**Event Types:**
| Event | When Fired |
|-------|------------|
| `APP_INITIALIZED` | App initialized, loader visible |
| `APP_READY` | Fully loaded and ready |
| `MESSAGE_RECEIVED` | LLM message generated |
| `MESSAGE_SENT` | User message sent |
| `CHAT_CHANGED` | Chat switched |
| `GENERATION_AFTER_COMMANDS` | Generation starting |
| `GENERATION_STOPPED` | User stopped generation |
| `GENERATION_ENDED` | Generation completed |

### Text Generation API

```javascript
const { generateQuietPrompt, generateRaw } = getContext();

// Generate with chat context (quiet prompt - not rendered in chat)
const result = await generateQuietPrompt({
    quietPrompt: 'Generate a summary of the chat.'
});

// Generate raw (no context, full control)
const result = await generateRaw({
    systemPrompt: 'You are helpful.',
    prompt: 'Tell me a story.',
    prefill: 'Once upon a time,'
});

// Structured Outputs (JSON Schema)
const result = await generateRaw({
    prompt: 'Extract story state.',
    jsonSchema: {
        name: 'StoryState',
        strict: true,
        value: {
            type: 'object',
            properties: {
                location: { type: 'string' },
                plans: { type: 'string' }
            },
            required: ['location']
        }
    }
});
```

### Persistent Settings

```javascript
const { extensionSettings, saveSettingsDebounced } = getContext();
const MODULE_NAME = 'my_extension';

function getSettings() {
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = { enabled: false };
    }
    return extensionSettings[MODULE_NAME];
}

// Save changes
const settings = getSettings();
settings.enabled = true;
saveSettingsDebounced();
```

### Chat Metadata

```javascript
const { chatMetadata, saveMetadata } = getContext();

// Store data for current chat
chatMetadata['my_key'] = 'value';
await saveMetadata();
```

### Shared Libraries (SillyTavern.libs)

```javascript
const { lodash, localforage, Fuse, DOMPurify, Handlebars, moment, showdown } = SillyTavern.libs;

// Fuzzy search
const fuse = new Fuse(items, { keys: ['name', 'description'] });
const results = fuse.search('query');

// Sanitize HTML
const clean = DOMPurify.sanitize(userInput);
```

### Prompt Interceptors

Modify chat data before generation.

**manifest.json:**
```json
{
    "display_name": "My Interceptor",
    "generate_interceptor": "myInterceptorFunction"
}
```

**index.js:**
```javascript
globalThis.myInterceptorFunction = async function(chat, contextSize, abort, type) {
    // Add system note before last message
    const note = {
        is_user: false,
        name: "System",
        send_date: Date.now(),
        mes: "Additional context!"
    };
    chat.splice(chat.length - 1, 0, note);
    
    // Or abort generation
    // abort(true);
};
```

### Custom Macros

```javascript
const { registerMacro, unregisterMacro } = getContext();

// Register function macro
registerMacro('tomorrow', () => {
    return new Date(Date.now() + 24*60*60*1000).toLocaleDateString();
});

// Usage in prompts: {{tomorrow}}

// Unregister when done
unregisterMacro('tomorrow');
```

### Slash Commands

```javascript
SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'repeat',
    callback: (namedArgs, unnamedArgs) => {
        const times = namedArgs.times ?? 5;
        return Array(times).fill(unnamedArgs.toString()).join(' ');
    },
    aliases: ['rep'],
    returns: 'repeated text',
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({
            name: 'times',
            description: 'Number of times',
            typeList: ARGUMENT_TYPE.NUMBER,
            defaultValue: '5'
        })
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'Text to repeat',
            typeList: ARGUMENT_TYPE.STRING,
            isRequired: true
        })
    ]
}));
```

---

## 2. Server Plugins (Node.js)

For functionality requiring Node.js (new API endpoints, filesystem access, npm packages).

### File Structure

Place in SillyTavern's `plugins/` directory:

```
plugins/
└── my-plugin/
    ├── index.js    # CommonJS
    ├── index.mjs   # ES Modules
    └── package.json
```

### Plugin Format

```javascript
// index.js
async function init(router) {
    // router registered at /api/plugins/{id}/
    router.get('/hello', (req, res) => {
        res.json({ message: 'Hello from plugin!' });
    });
    console.log('My plugin loaded!');
    return Promise.resolve();
}

async function exit() {
    // Cleanup on shutdown
    return Promise.resolve();
}

module.exports = {
    init,
    exit,
    info: {
        id: 'my-plugin',
        name: 'My Plugin',
        description: 'Does cool things'
    }
};
```

**Enable in config.yaml:**
```yaml
enableServerPlugins: true
```

---

## 3. Installation

1. Place extension folder in `data/<user-handle>/extensions/`
2. Or use "Install extension" in Extensions panel with Git repository URL
3. Enable in Extensions panel → Manage extensions

---

## 4. Best Practices

- **Never store API keys** in `extensionSettings` (visible to all extensions)
- **Use `getContext()`** instead of direct imports for stability
- **Clean up event listeners** when disabling extension
- **Use async/await** for heavy operations to avoid blocking UI
- **Use DOMPurify** to sanitize user inputs
- **Provide clear feedback** with toastr notifications

---

## 5. Resources

| Resource | URL |
|----------|-----|
| Official Docs | https://docs.sillytavern.app/for-contributors/writing-extensions/ |
| Server Plugins | https://docs.sillytavern.app/for-contributors/server-plugins/ |
| Function Calling | https://docs.sillytavern.app/for-contributors/function-calling/ |
| Basic Template | https://github.com/city-unit/st-extension-example |
| React Template | https://github.com/SillyTavern/Extension-ReactTemplate |
| Webpack Template | https://github.com/SillyTavern/Extension-WebpackTemplate |
| Server Plugin Template | https://github.com/SillyTavern/Plugin-WebpackTemplate |
| Official Extensions | https://github.com/search?q=topic%3Aextension+org%3ASillyTavern |
| Source Code | https://github.com/SillyTavern/SillyTavern |
