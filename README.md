# ZAI GLM Autocomplete

Inline code completion for VS Code and VSCodium, backed by the [GLM Coding Plan](https://z.ai) from Z.AI. You type, GLM continues, the suggestion shows up as ghost text. Tab to accept, Esc to ignore.

It works with the standard Coding Plan endpoint, so a Lite, Pro, or Max subscription is enough. No proxy, no account system, one API key.

## What it does

- Ghost text suggestions on every keystroke, debounced and cancellable, powered by `glm-5.3-flash` by default
- Prefix and suffix of the current file go out as context, so suggestions follow the code you already wrote
- Raw model output gets cleaned before display: markdown fences stripped, echoed code removed, brackets that already exist in the buffer trimmed
- Commit message generation from staged or unstaged changes (untracked files included), written straight into the SCM input box
- The API key lives in VS Code secret storage, never in settings.json
- Status bar item shows idle, thinking, error, and missing-key states
- Works in VS Code 1.84+ and VSCodium

## Setup

1. Get an API key from the [Z.AI API keys page](https://z.ai/manage-apikey/apikey-list). A Coding Plan subscription covers the default endpoint.
2. Install the extension (see below).
3. Run **ZAI Autocomplete: Set API Key** from the command palette and paste the key.

The key is stored through VS Code's SecretStorage API. On headless setups where you cannot open the input box, the extension also reads a `ZAI_API_KEY` environment variable as a fallback.

### Installing the VSIX

Grab a `vsix` from the releases page (or build one with `npx vsce package`), then:

```bash
code --install-extension vscode-zai-autocomplete-0.1.0.vsix
# codium --install-extension ... on VSCodium
```

Or open the Extensions view, pick **Install from VSIX...**, and select the file.

### Building from source

```bash
npm install
npm test
npx vsce package
```

## Configuration

All settings live under `zaiAutocomplete`. The defaults work with a standard GLM Coding Plan subscription.

| Setting | Default | What it controls |
| --- | --- | --- |
| `enabled` | `true` | Master switch. The status bar item toggles this too. |
| `baseUrl` | `https://api.z.ai/api/coding/paas/v4` | Coding Plan endpoint. Use `https://api.z.ai/api/paas/v4` with a pay-as-you-go key. |
| `model` | `glm-5.3-flash` | Fastest option. `glm-5.3` is stronger but slower; `glm-5.3-flashx` needs a plan tier that includes it. |
| `maxTokens` | `256` | Cap on generated tokens per suggestion. |
| `temperature` | `0.2` | Low keeps suggestions predictable. |
| `debounceMs` | `300` | Idle time after the last keystroke before a request goes out. |
| `prefixChars` | `3000` | Code before the cursor sent as context. |
| `suffixChars` | `1500` | Code after the cursor sent as context. |
| `maxCompletionLines` | `8` | Hard cap on suggestion length. |
| `timeoutMs` | `10000` | Request timeout. |
| `disableThinking` | `true` | Sends `thinking: disabled` so reasoning models answer directly. Turn off if your endpoint rejects the parameter. |
| `commitModel` | `glm-5.3` | Model for commit message generation. It is a one-shot call, so a stronger model is a fine choice. Leave empty to reuse the completion model. |
| `maxCommitDiffChars` | `60000` | Commit message generation reads at most this many characters of diff. |
| `excludeLanguages` | `plaintext`, `log` | Language IDs that never get suggestions. |
| `maxFileChars` | `200000` | Files longer than this are skipped. |
| `showStatusBar` | `true` | Show the status bar item. |

## Commands

| Command | What it does |
| --- | --- |
| `ZAI Autocomplete: Set API Key` | Prompts for the key, stores it in secret storage |
| `ZAI Autocomplete: Clear API Key` | Removes the stored key |
| `ZAI Autocomplete: Enable/Disable Suggestions` | Flips `zaiAutocomplete.enabled` |
| `ZAI Autocomplete: Suggest Completion at Cursor` | Forces a suggestion without waiting for the debounce |
| `ZAI Autocomplete: Show Logs` | Opens the output channel |
| `ZAI Autocomplete: Generate Commit Message` | Writes a commit message into the SCM input box from staged or unstaged changes |

There is no default keybinding that could shadow editor keys. If you want a manual trigger, bind something to the trigger command above.

## Commit messages

The sparkle button in the Source Control view title bar (or the **ZAI Autocomplete: Generate Commit Message** command) writes a commit message into the SCM input box.

It describes your staged changes when the index is not empty and falls back to unstaged changes otherwise. New untracked files, which `git diff` never shows, get folded in as content so a brand new module still gets described. With several repositories open, the repo holding the active editor's file wins.

The message follows Conventional Commits: a lowercase imperative subject of at most 72 characters, with a short body only when the subject alone leaves real questions open. Like Copilot, it replaces whatever is already in the input box.

The button sits in the view title rather than inside the input box because the input box menu is proposed API that only Microsoft's bundled extensions can ship.

## Privacy

Each completion request sends roughly the last 3000 characters and the next 1500 characters of the current file to Z.AI, plus the file name and language. Commit message generation sends the staged or unstaged diff of the selected repository, plus the contents of new untracked files, capped by `maxCommitDiffChars`. Nothing else leaves the editor, no telemetry, no history. Requests carry your API key. If that trade is not acceptable for a file, disable suggestions from the status bar or exclude the language.

## How it works

The extension registers an `InlineCompletionItemProvider` and builds one chat request per trigger: a system prompt that describes the completion contract, and a user message containing the file context with a `<CURSOR>` marker. The response goes through a sanitizer that strips fences, drops prose preambles, removes code echoed from before the cursor, and trims bracket duplication against the text after the cursor. What survives shows up as ghost text.

Thinking is disabled on requests by default (`reasoning_tokens: 0`), which keeps `glm-5.3-flash` around the one second mark for small completions.

## Troubleshooting

- **401 on every request**: the key is wrong for the endpoint. Coding Plan keys go with the `coding` base URL, pay-as-you-go keys with the plain one.
- **429 with `glm-5.3-flashx`**: your plan does not include FlashX yet. Switch back to `glm-5.3-flash`.
- **No suggestions at all**: check the status bar. A key icon means no key is set, a crossed zap means the last request errored, and the output channel has details.
- **Suggestions feel slow**: lower `prefixChars` and `suffixChars`, or stay on `glm-5.3-flash`.

## License

[MIT](LICENSE)
