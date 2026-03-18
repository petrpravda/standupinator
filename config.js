const vscode = require('vscode');

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Parses the workingDays string e.g. "MO,TU,WE,TH,FR" into a Set of JS day
 * numbers (0=Sun, 1=Mon … 6=Sat).
 */
function parseWorkingDays(str) {
  const days = new Set();
  for (const part of str.toUpperCase().split(',')) {
    const trimmed = part.trim();
    const idx = DAY_CODES.indexOf(trimmed);
    if (idx !== -1) days.add(idx);
  }
  return days;
}

/**
 * Walks backwards from now until it has accumulated `hoursBack` hours that
 * fall on working days, then returns an ISO string suitable for git --since.
 *
 * Example: today is Monday 09:00, hoursBack=8, workingDays=MO-FR
 *   → skips Sunday and Saturday entirely, reaches back to Friday afternoon.
 *
 * Resolution is 1 minute for reasonable precision without being slow.
 */
function computeSinceDate(hoursBack, workingDays) {
  const STEP_MS = 60 * 1000; // 1-minute resolution
  const totalMs = hoursBack * 60 * 60 * 1000;

  let cursor = new Date();
  let accumulated = 0;

  while (accumulated < totalMs) {
    cursor = new Date(cursor.getTime() - STEP_MS);
    const dayOfWeek = cursor.getDay(); // 0=Sun … 6=Sat
    if (workingDays.has(dayOfWeek)) {
      accumulated += STEP_MS;
    }
  }

  return cursor.toISOString();
}

/**
 * The default prompt template. Supports these placeholders:
 *   {{sentenceCount}}  - replaced with the sentenceCount setting
 *   {{language}}       - replaced with the language setting
 */
const DEFAULT_PROMPT_TEMPLATE =
  `You are a concise engineering assistant. ` +
  `Summarize the provided git activity in exactly {{sentenceCount}} short sentence(s). ` +
  `Do not mention counts of files, lines, or commits. ` +
  `Do not use buzzwords. ` +
  `Write plain, direct sentences describing what was worked on. ` +
  `Respond in {{language}}.`;

/**
 * Resolves the prompt template: substitutes {{sentenceCount}} and {{language}}
 * with their current config values.
 */
function resolvePrompt(template, sentenceCount, language) {
  return template
    .replace(/\{\{sentenceCount\}\}/g, String(sentenceCount))
    .replace(/\{\{language\}\}/g, language);
}

/**
 * Reads all Standupinator settings and returns a resolved config object.
 */
function readConfig() {
  const cfg = vscode.workspace.getConfiguration('standupinator');

  const hoursBack         = cfg.get('hoursBack');
  const authorFilter      = cfg.get('authorFilter');
  const diffLineThreshold = cfg.get('diffLineThreshold');
  const extraExcludes     = cfg.get('excludePatterns');
  const model             = cfg.get('model');
  const language          = cfg.get('language');
  const sentenceCount     = cfg.get('sentenceCount');
  const workingDaysStr    = cfg.get('workingDays');
  const promptTemplate    = cfg.get('promptTemplate') || DEFAULT_PROMPT_TEMPLATE;

  const workingDays = parseWorkingDays(workingDaysStr);

  // Fallback: if string is empty or invalid, treat every day as working
  const effectiveWorkingDays = workingDays.size > 0
    ? workingDays
    : new Set([0, 1, 2, 3, 4, 5, 6]);

  const sinceDate = computeSinceDate(hoursBack, effectiveWorkingDays);

  const resolvedPrompt = resolvePrompt(promptTemplate, sentenceCount, language);

  return {
    hoursBack,
    authorFilter,
    diffLineThreshold,
    extraExcludes: extraExcludes || [],
    model,
    language,
    sentenceCount,
    workingDays: effectiveWorkingDays,
    sinceDate,
    resolvedPrompt,
  };
}

module.exports = { readConfig, DEFAULT_PROMPT_TEMPLATE };
