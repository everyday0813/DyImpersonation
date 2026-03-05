# SillyTavern Impersonation Extension

A SillyTavern extension that generates AI-powered user impersonation - dialogue and action continuations based on chat context and user persona.

## Features

- 🪄 **Wand Button** - Click to generate a ~100 character continuation
- **Smart Context** - Uses chat history (10k tokens) + user persona
- **Quote Handling** - Auto-detects and closes unclosed quotes
- **Accumulation** - Each click appends a new sentence (never replaces)
- **Loading State** - Prevents spam clicks during generation

## Installation

### Method 1: Via SillyTavern (Recommended)

1. Go to **Extensions Panel → Manage Extensions**
2. Click **"Install extension"**
3. Paste this URL:
   ```
   https://github.com/everyday0813/sillytavern-impersonation
   ```
4. Click **Install**
5. Enable the extension

### Method 2: Manual

1. Download or clone this repository
2. Copy the `impersonation` folder to:
   ```
   SillyTavern/data/<your-username>/extensions/impersonation/
   ```
3. Restart SillyTavern or refresh the browser
4. Enable in **Extensions → Manage Extensions**

## Usage

1. The 🪄 wand button appears **left of the send button**
2. **Empty input**: Click to generate continuation from chat
3. **Partial input**: Type `"I don't know...` and click - it will continue and close the quote
4. **Multiple clicks**: Each click adds a new sentence

## How It Works

1. Gathers recent chat history for context
2. Detects user persona from chat metadata or settings
3. Builds a continuation prompt based on current input
4. Generates ~100 characters of dialogue/action
5. Appends to your input box

## Configuration

The extension uses sensible defaults but you can modify the code in `index.js`:
- `MAX_CHARS` - Maximum characters per generation (default: 100)
- `CONTEXT_TOKENS` - Chat context window (default: 10000)

## Requirements

- SillyTavern 1.0.0 or higher
- An AI backend configured in SillyTavern

## License

MIT
