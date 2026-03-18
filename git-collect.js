const { spawnSync } = require('child_process');
const path = require('path');

const DIFF_LINE_THRESHOLD = 100;

const EXCLUDE_PATTERNS = [
  ':(exclude)package-lock.json',
  ':(exclude)yarn.lock',
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)go.sum',
  ':(exclude)Gemfile.lock',
  ':(exclude)composer.lock',
  ':(exclude)*.min.js',
  ':(exclude)*.min.css',
  ':(exclude)*.map',
  ':(exclude)dist/*',
  ':(exclude)build/*',
  ':(exclude).next/*',
  ':(exclude)out/*',
  ':(exclude)coverage/*',
];

function git(repoPath, args, { trim = true } = {}) {
  const result = spawnSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) return '';
  const out = result.stdout || '';
  return trim ? out.trim() : out;
}

function parseShortStat(line) {
  const match = line.match(
    /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/
  );
  if (!match) return { filesChanged: 0, insertions: 0, deletions: 0 };
  return {
    filesChanged: parseInt(match[1] || '0', 10),
    insertions:   parseInt(match[2] || '0', 10),
    deletions:    parseInt(match[3] || '0', 10),
  };
}

function getCommits(repoPath) {
  const userEmail = git(repoPath, ['config', 'user.email']);
  const raw = git(repoPath, [
    'log',
    '--since=24 hours ago',
    `--author=${userEmail}`,
    '--shortstat',
    '--format=COMMIT:%H|%an|%ae|%ai|%s',
  ]);
  if (!raw) return [];

  const commits = [];
  let current = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT:')) {
      if (current) commits.push(current);
      const parts = line.slice(7).split('|');
      const [hash, author, email, date, ...subjectParts] = parts;
      current = {
        hash,
        shortHash: hash.slice(0, 7),
        author,
        date: new Date(date),
        subject: subjectParts.join('|'),
        stats: { filesChanged: 0, insertions: 0, deletions: 0 },
        diff: null,
        files: null,
      };
    } else if (current && line.match(/\d+ files? changed/)) {
      current.stats = parseShortStat(line);
    }
  }
  if (current) commits.push(current);
  return commits;
}

function enrichCommit(repoPath, commit) {
  const statLine = git(repoPath, [
    'diff', '--shortstat', `${commit.hash}^!`,
    '--', ...EXCLUDE_PATTERNS,
  ]);

  const stats = parseShortStat(statLine);
  commit.stats = stats;
  const totalLines = stats.insertions + stats.deletions;

  if (totalLines < DIFF_LINE_THRESHOLD) {
    commit.diff = git(repoPath, [
      'diff', `${commit.hash}^!`,
      '--', ...EXCLUDE_PATTERNS,
    ], { trim: false });
  } else {
    const names = git(repoPath, [
      'diff', '--name-only', `${commit.hash}^!`,
      '--', ...EXCLUDE_PATTERNS,
    ]);
    commit.files = names
      ? names.split('\n').filter(Boolean).map(f => path.basename(f))
      : [];
  }

  return commit;
}

function buildMarkdown(repoPath, commits) {
  const enriched = commits.map(c => enrichCommit(repoPath, c));
  const lines = [];

  lines.push(`# Git Activity — last 24 hours`);
  lines.push(`**Repo:** ${repoPath}  `);
  lines.push(`**Generated:** ${new Date().toISOString()}  `);
  lines.push(`**Commits:** ${enriched.length}`);
  lines.push('');

  for (const c of enriched) {
    lines.push(`## ${c.subject}`);
    lines.push(`> \`${c.shortHash}\` · ${c.author} · ${c.date.toISOString().replace('T', ' ').slice(0, 19)} UTC`);
    lines.push('');
    lines.push(`**Changes:** ${c.stats.filesChanged} file(s) changed, +${c.stats.insertions} / -${c.stats.deletions}`);
    lines.push('');

    if (c.files) {
      lines.push('**Changed files:**');
      for (const f of c.files) lines.push(`- \`${f}\``);
    } else if (c.diff && c.diff.trim()) {
      lines.push('**Diff:**');
      lines.push('```diff');
      lines.push(c.diff.trim());
      lines.push('```');
    } else {
      lines.push('_No meaningful diff (all files excluded)._');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Main entry point.
 * @param {string} repoPath - Absolute path to the git repository.
 * @returns {{ markdown: string, commitCount: number } | { error: string }}
 */
function collectGitSummary(repoPath) {
  const repoRoot = git(repoPath, ['rev-parse', '--show-toplevel']);
  if (!repoRoot) {
    return { error: `"${repoPath}" is not a git repository.` };
  }

  const commits = getCommits(repoRoot);
  if (commits.length === 0) {
    return { markdown: '', commitCount: 0 };
  }

  return {
    markdown: buildMarkdown(repoRoot, commits),
    commitCount: commits.length,
  };
}

module.exports = { collectGitSummary };
