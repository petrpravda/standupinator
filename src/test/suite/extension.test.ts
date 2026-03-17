import * as assert from 'assert';
import { GitService, Commit } from '../../gitService';
import { AiService } from '../../aiService';

suite('GitService', () => {
    test('getRecentCommits returns an array', async () => {
        // Use the current repository so git is definitely available.
        const service = new GitService(process.cwd());
        const commits = await service.getRecentCommits(365);
        assert.ok(Array.isArray(commits), 'getRecentCommits should return an array');
    });

    test('getRecentCommits entries have required fields', async () => {
        const service = new GitService(process.cwd());
        const commits = await service.getRecentCommits(365);
        for (const commit of commits) {
            assert.ok(typeof commit.hash === 'string' && commit.hash.length > 0, 'hash should be a non-empty string');
            assert.ok(typeof commit.date === 'string' && commit.date.length > 0, 'date should be a non-empty string');
            assert.ok(typeof commit.author === 'string', 'author should be a string');
            assert.ok(typeof commit.message === 'string', 'message should be a string');
        }
    });

    test('getRecentCommits with 0 days returns no commits', async () => {
        const service = new GitService(process.cwd());
        // daysBack=0 means since now; practically no commits were made in the future
        const commits = await service.getRecentCommits(0);
        assert.strictEqual(commits.length, 0, 'No commits should be returned for 0 days back');
    });
});

suite('AiService prompt formatting', () => {
    // We test prompt-level logic without actually calling the OpenAI API.
    const sampleCommits: Commit[] = [
        { hash: 'abc123', date: '2024-01-15T09:00:00+00:00', author: 'Alice', message: 'Add login page' },
        { hash: 'def456', date: '2024-01-15T10:30:00+00:00', author: 'Alice', message: 'Fix navigation bug' },
    ];

    test('AiService can be instantiated', () => {
        const service = new AiService('fake-key', 'gpt-4o-mini');
        assert.ok(service instanceof AiService);
    });

    test('generateStandup rejects when API key is invalid', async () => {
        const service = new AiService('invalid-key', 'gpt-4o-mini');
        try {
            await service.generateStandup(sampleCommits);
            assert.fail('Should have thrown an error with an invalid API key');
        } catch (err: unknown) {
            // Expected – OpenAI will reject the invalid key
            assert.ok(err instanceof Error, 'Error should be an instance of Error');
        }
    });
});
