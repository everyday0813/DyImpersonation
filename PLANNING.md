# Impersonation Extension - Planning Document

## Overview

A SillyTavern extension that generates user-style continuations for roleplay, one sentence at a time.

---

## Core Features

### 1. UI Component
- **Wand button** (🪄 or magic wand icon) positioned **left of send button**
- **Loading state**: Show spinner/animation while generating
- **Disabled state**: Prevent clicks during generation

### 2. Generation Behavior
| Scenario | Behavior |
|----------|----------|
| Empty input box | Continue roleplay from chat history |
| Partial text input | Continue from user's text |
| Unclosed quote (`"Hello...`) | Complete the quote and close when fitting |
| After first sentence | Append second sentence to first |

### 3. Output Format
```
Dialogue in quotes + plain narrative/action
Example: "I don't know what to say." She looked away, rubbing her arm nervously.
```

### 4. Context Sources
- **Chat history**: ~10k tokens of conversation
- **User persona**: Chat-specific persona (personality, speech patterns, traits)

### 5. Accumulation Logic
```
Click 1 → Generate sentence → Append to input box → Ready for click 2
Click 2 → Generate next sentence → Append to previous → Ready for click 3
...
```
- **Never replaces** - always appends
- User can edit accumulated text before sending
- Each sentence ~100 characters max

---

## Technical Design

### File Structure
```
impersonation/
├── manifest.json       # Extension metadata
├── index.js            # Main logic
├── style.css           # Wand button styling
└── settings.html       # Optional: configuration panel
```

### Key Components

#### A. Wand Button Injection
```javascript
// Inject button left of send button
const wandButton = $('<button id="impersonation-wand">🪄</button>');
wandButton.insertBefore('#send_but');
```

#### B. Context Gathering
```javascript
async function gatherContext() {
    const context = getContext();
    
    // Get chat history (last 10k tokens)
    const recentChat = context.chat.slice(-N_MESSAGES);
    
    // Get chat-specific user persona
    const persona = getUserPersona(context);
    
    return { chat: recentChat, persona };
}
```

#### C. Generation Call
```javascript
async function generateContinuation(currentInput) {
    const { chat, persona } = await gatherContext();
    
    const prompt = buildPrompt(chat, persona, currentInput);
    
    const result = await generateQuietPrompt({
        quietPrompt: prompt,
        maxTokens: 50  // ~100 chars
    });
    
    return result;
}
```

#### D. State Management
```javascript
let isGenerating = false;

wandButton.on('click', async () => {
    if (isGenerating) return;
    
    isGenerating = true;
    wandButton.addClass('loading');
    
    try {
        const currentInput = $('#send_textarea').val();
        const continuation = await generateContinuation(currentInput);
        
        // Append to input box
        $('#send_textarea').val(currentInput + continuation);
    } finally {
        isGenerating = false;
        wandButton.removeClass('loading');
    }
});
```

---

## Prompt Engineering (Draft)

### System Context
```
You are continuing a roleplay as the USER character.
Your task: Write the NEXT sentence only (max 100 chars).

User Persona: [persona description]
Speech Style: [extracted patterns from persona]
```

### Continuation Prompt
```
Recent conversation:
[chat history excerpts]

Current partial input: "[user's partial text]"

Continue naturally as the user. If there's an unclosed quote, complete and close it.
Include brief action/narrative if appropriate.
Output ONLY the continuation, nothing else.
```

---

## Settings (Optional)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `maxChars` | number | 100 | Max characters per generation |
| `contextTokens` | number | 10000 | Chat history context size |
| `buttonIcon` | string | "🪄" | Wand button icon |
| `showLoading` | boolean | true | Show loading spinner |

---

## Installation

1. Copy the `impersonation` folder to your SillyTavern extensions directory:
   ```
   SillyTavern/data/<your-username>/extensions/impersonation/
   ```
2. Restart SillyTavern or reload the page
3. Enable the extension in **Extensions Panel → Manage Extensions**
4. The 🪄 wand button will appear left of the send button

---

## Implementation Phases

### Phase 1: MVP ✅ COMPLETED
- [x] Create extension structure (manifest.json, index.js, style.css)
- [x] Inject wand button left of send button
- [x] Implement loading state
- [x] Gather chat context + user persona
- [x] Basic generation call
- [x] Append result to input box

### Phase 2: Refinement ✅ COMPLETED
- [x] Handle partial quotes (detect unclosed quotes)
- [x] Prompt engineering for better continuations
- [x] Accumulation across multiple clicks
- [x] Error handling (API failures, empty context)

### Phase 3: Polish (Optional)
- [ ] Settings panel for customization
- [ ] Loading animation
- [ ] Keyboard shortcut (optional)
- [ ] Better context windowing

---

## Current Implementation Status

**STATUS: MVP Complete and Ready for Testing**

Files created:
```
impersonation/
├── manifest.json   ✅
├── index.js        ✅ (312 lines)
└── style.css       ✅ (66 lines)
```

---

## Questions / Decisions (Resolved)

1. **Icon**: ✅ Emoji 🪄
2. **API**: ✅ Using `generateQuietPrompt`
3. **Persona detection**: ✅ Checks chatMetadata → extensionSettings → userAvatar
4. **Error feedback**: ✅ toastr notifications + console logs

---

## Notes

- Extension folder name: `impersonation`
- Target location: `data/<user>/extensions/impersonation/`
- Uses: jQuery, toastr (built into SillyTavern)
