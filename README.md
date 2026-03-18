# Standupinator

> **One command. Three sentences. Ready for standup.**

Standupinator is a VS Code extension that reads your git commits from the last 24 hours and uses GitHub Copilot to produce a concise, human-readable summary — ready to paste into Slack, a standup call, or a daily log.

---

## How it works

1. Press `Ctrl+Shift+P` and type **Standupinator**
2. A panel opens and streams your summary in real time
3. Hit **Copy** and paste it wherever you need it

That's it. No configuration required.

---

## Example output

> Worked on improving security across the authentication layer and session handling. Added a roles switcher and extended logging to help diagnose login issues. Fixed a repeatable word playback bug and corrected a query returning stale results.

---

## Requirements

- **VS Code 1.90** or later
- **GitHub Copilot** extension installed and signed in (any active plan)
- A **git repository** open as your workspace

No API keys. No external services. The summary is generated locally through the VS Code Language Model API provided by GitHub Copilot.

---

## Installation

### From the VS Code Marketplace (recommended)

1. Open VS Code
2. Go to **Extensions** (`Ctrl+Shift+X` / `Cmd+Shift+X` on macOS)
3. Search for **"Standupinator"**
4. Click **Install**

### From the `.vsix` file

Download the latest `.vsix` from [GitHub Releases](https://github.com/petrpravda/standupinator/releases) and install:

```bash
code --install-extension standupinator-0.0.3.vsix
```

### From source

```bash
git clone git@github.com:petrpravda/standupinator.git
cd standupinator
npm install
npx vsce package --allow-missing-repository --no-dependencies
code --install-extension standupinator-0.0.3.vsix
```

---

## Usage

1. Open a folder that is a git repository in VS Code
2. Open the Command Palette: `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
3. Type **Standupinator** and press Enter
4. On first run, VS Code will ask you to allow the extension to use the Copilot language model — click **Allow**
5. Your summary streams in. Use the **Copy** button to grab it.

---

## How commits are collected

Standupinator runs `git log` for the last 24 hours directly against your workspace folder. For each commit:

- If the diff is **under 100 changed lines** (excluding noise files), the full diff is included — giving the LLM enough context to write an accurate summary
- If the diff is **100 lines or more**, only the changed filenames are included to keep the prompt lean

The following files are automatically excluded from diffs:

| Category | Files |
|---|---|
| Lock files | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `go.sum`, `Gemfile.lock`, `composer.lock` |
| Minified | `*.min.js`, `*.min.css` |
| Source maps | `*.map` |
| Build output | `dist/`, `build/`, `.next/`, `out/`, `coverage/` |

---

## Troubleshooting

**"No GitHub Copilot language model is available"**
Make sure the GitHub Copilot extension is installed and you are signed in. The `vscode.lm` API requires an active Copilot session.

**"No commits found in the last 24 hours"**
There are no commits in your repo from the past 24 hours. Nothing to summarize.

**"Not a git repository"**
The workspace folder does not contain a `.git` directory. Open a git-initialized project.

**"No workspace folder open"**
You have a single file open instead of a folder. Use **File → Open Folder** first.

---

## Love Standupinator? ❤️

Drop a star on the [GitHub repo](https://github.com/petrpravda/standupinator) ⭐ — it really makes my day! 💫 And if you're feeling extra generous, [leave a review on the Marketplace](https://marketplace.visualstudio.com/items?itemName=petrpravda.standupinator&ssr=false#review-details) 💕

---

## Project structure

```
standupinator/
├── extension.js      # VS Code extension entry point, Copilot LM API, webview
├── git-collect.js    # Git log collection and diff processing
├── package.json
└── .vscodeignore
```

---

## License

MIT
