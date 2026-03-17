# standupinator
VS Code extension for AI-powered standup updates so you can spend less time talking and more time coding

## Features

- **Generate Standup Update** command: reads your recent git commits and uses OpenAI to produce a concise standup message.
- Configurable look-back window (default: 1 day).
- Output appears in the **Standupinator** output channel in VS Code.

## Requirements

- A workspace with at least one git repository.
- An [OpenAI API key](https://platform.openai.com/account/api-keys).

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `standupinator.openaiApiKey` | `""` | OpenAI API key. Can also be set via the `OPENAI_API_KEY` environment variable. |
| `standupinator.model` | `"gpt-4o-mini"` | OpenAI model to use (e.g. `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`). |
| `standupinator.daysBack` | `1` | Number of days to look back for commits. |

## Usage

1. Open a workspace that contains a git repository.
2. Set your OpenAI API key in VS Code settings (`Standupinator: Openai Api Key`) or export `OPENAI_API_KEY` in your shell.
3. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Standupinator: Generate Standup Update**.
4. The generated standup appears in the **Standupinator** output panel.

## Development

```bash
npm install
npm run compile   # build
npm run lint      # lint
npm test          # run tests (requires a display / VS Code test runner)
```
