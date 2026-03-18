const vscode = require('vscode');
const { collectGitSummary } = require('./git-collect');
const { readConfig } = require('./config');

/**
 * Calls GitHub Copilot via the VS Code Language Model API with streaming.
 *
 * @param {string} prompt
 * @param {object} config
 * @param {function(string): void} onToken
 * @param {vscode.CancellationToken} cancelToken
 * @returns {Promise<void>}
 */
async function callCopilot(prompt, config, onToken, cancelToken) {
  let [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: config.model });

  if (!model) {
    const fallback = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    model = fallback[0];
  }

  if (!model) {
    throw new Error(
      'No GitHub Copilot language model is available. ' +
      'Make sure the GitHub Copilot extension is installed and you are signed in.'
    );
  }

  const messages = [
    vscode.LanguageModelChatMessage.User(
      config.resolvedPrompt + '\n\n' + prompt
    ),
  ];

  const response = await model.sendRequest(messages, {}, cancelToken);

  for await (const chunk of response.text) {
    onToken(chunk);
  }
}

/**
 * Creates and shows the result webview panel.
 */
function createPanel(config) {
  const panel = vscode.window.createWebviewPanel(
    'standupinator',
    'Standupinator',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  function render(bodyContent) {
    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Standupinator</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px 32px;
      max-width: 760px;
      margin: 0 auto;
      line-height: 1.6;
    }
    h1 {
      font-size: 1.4em;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--vscode-textLink-foreground);
    }
    .subtitle {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 28px;
    }
    .summary-box {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      padding: 16px 20px;
      border-radius: 4px;
      white-space: pre-wrap;
      font-size: 1.05em;
      min-height: 3em;
    }
    .copy-btn {
      margin-top: 16px;
      padding: 6px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
    }
    .copy-btn:hover { opacity: 0.85; }
    .error {
      color: var(--vscode-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      padding: 12px 16px;
      border-radius: 4px;
    }
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid var(--vscode-descriptionForeground);
      border-top-color: var(--vscode-textLink-foreground);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <h1>☕ Standupinator</h1>
  <div class="subtitle">Since ${new Date(config.sinceDate).toLocaleString()} · ${new Date().toLocaleString()}</div>
  ${bodyContent}
  <script>
    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.type === 'append') {
        const box = document.getElementById('summary');
        if (box) box.textContent += msg.text;
      }
      if (msg.type === 'done') {
        const spinner = document.getElementById('spinner');
        if (spinner) spinner.remove();
        const btn = document.getElementById('copybtn');
        if (btn) btn.style.display = 'inline-block';
      }
    });
    function copyToClipboard() {
      const text = document.getElementById('summary')?.textContent || '';
      navigator.clipboard.writeText(text);
    }
  </script>
</body>
</html>`;
  }

  function showStreaming() {
    render(`
      <div class="summary-box">
        <span class="spinner" id="spinner"></span><span id="summary"></span>
      </div>
      <button class="copy-btn" id="copybtn" style="display:none" onclick="copyToClipboard()">Copy</button>
    `);
  }

  function append(text) {
    panel.webview.postMessage({ type: 'append', text });
  }

  function markDone() {
    panel.webview.postMessage({ type: 'done' });
  }

  function setError(message) {
    render(`<div class="error"><strong>Error:</strong> ${message}</div>`);
  }

  return { panel, showStreaming, append, markDone, setError };
}

// ── Extension entry points ────────────────────────────────────

function activate(context) {
  const disposable = vscode.commands.registerCommand('standupinator.run', async () => {

    // 1. Resolve repo path
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('Standupinator: No workspace folder open.');
      return;
    }
    const repoPath = workspaceFolders[0].uri.fsPath;

    // 2. Read config (includes working-days since-date calculation)
    const config = readConfig();

    // 3. Open panel immediately
    const { showStreaming, append, markDone, setError } = createPanel(config);
    showStreaming();

    // 4. Collect git data (synchronous, fast)
    let gitResult;
    try {
      gitResult = collectGitSummary(repoPath, config);
    } catch (err) {
      setError(`Git collection failed: ${err.message}`);
      return;
    }

    if (gitResult.error) {
      setError(gitResult.error);
      return;
    }

    if (gitResult.commitCount === 0) {
      setError(`No commits found since ${new Date(config.sinceDate).toLocaleString()}.`);
      return;
    }

    // 5. Call Copilot with streaming
    const cancelSource = new vscode.CancellationTokenSource();
    context.subscriptions.push(cancelSource);

    try {
      await callCopilot(gitResult.markdown, config, (token) => append(token), cancelSource.token);
      markDone();
    } catch (err) {
      if (err.code === vscode.LanguageModelError.NotFound?.name) {
        setError('GitHub Copilot model not found. Is the Copilot extension installed and signed in?');
      } else if (err.code === vscode.LanguageModelError.Blocked?.name) {
        setError('Request was blocked by GitHub Copilot content filters.');
      } else if (err.code === vscode.LanguageModelError.NoPermissions?.name) {
        setError('Permission denied. Accept the Copilot LM API permission prompt in VS Code.');
      } else {
        setError(`Copilot request failed: ${err.message}`);
      }
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
