import * as vscode from 'vscode';
import { GitService } from './gitService';
import { AiService } from './aiService';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Standupinator');
    context.subscriptions.push(outputChannel);

    const command = vscode.commands.registerCommand('standupinator.generateStandup', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Standupinator: No workspace folder is open.');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const config = vscode.workspace.getConfiguration('standupinator');
        const daysBack: number = config.get<number>('daysBack', 1);
        const model: string = config.get<string>('model', 'gpt-4o-mini');
        const apiKey: string = config.get<string>('openaiApiKey', '') || process.env.OPENAI_API_KEY || '';

        if (!apiKey) {
            vscode.window.showErrorMessage(
                'Standupinator: OpenAI API key is not configured. ' +
                'Set it in Settings under "Standupinator: Openai Api Key" or via the OPENAI_API_KEY environment variable.'
            );
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Standupinator: Generating standup update…',
                cancellable: false,
            },
            async () => {
                try {
                    const gitService = new GitService(workspacePath);
                    const commits = await gitService.getRecentCommits(daysBack);

                    if (commits.length === 0) {
                        vscode.window.showInformationMessage(
                            `Standupinator: No commits found in the last ${daysBack} day(s).`
                        );
                        return;
                    }

                    const aiService = new AiService(apiKey, model);
                    const standup = await aiService.generateStandup(commits);

                    outputChannel.clear();
                    outputChannel.appendLine('=== Standup Update ===');
                    outputChannel.appendLine('');
                    outputChannel.appendLine(standup);
                    outputChannel.appendLine('');
                    outputChannel.appendLine(`Generated from ${commits.length} commit(s) over the last ${daysBack} day(s).`);
                    outputChannel.show(true);
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    vscode.window.showErrorMessage(`Standupinator: ${message}`);
                }
            }
        );
    });

    context.subscriptions.push(command);
}

export function deactivate(): void {
    // Nothing to clean up.
}
