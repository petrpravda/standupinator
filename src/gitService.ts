import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface Commit {
    hash: string;
    date: string;
    author: string;
    message: string;
}

export class GitService {
    constructor(private readonly workspacePath: string) {}

    /**
     * Returns commits made in the last `daysBack` days in the current workspace.
     */
    async getRecentCommits(daysBack: number): Promise<Commit[]> {
        const since = new Date();
        since.setDate(since.getDate() - daysBack);
        const sinceStr = since.toISOString();

        const separator = '||SEP||';
        const format = `%H${separator}%ai${separator}%an${separator}%s`;

        let stdout: string;
        try {
            const result = await execFileAsync(
                'git',
                ['log', `--since=${sinceStr}`, `--format=${format}`, '--no-merges'],
                { cwd: this.workspacePath }
            );
            stdout = result.stdout;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to read git log: ${message}`);
        }

        const commits: Commit[] = [];
        for (const line of stdout.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            const parts = trimmed.split(separator);
            if (parts.length < 4) {
                continue;
            }
            commits.push({
                hash: parts[0],
                date: parts[1],
                author: parts[2],
                message: parts.slice(3).join(separator),
            });
        }

        return commits;
    }
}
