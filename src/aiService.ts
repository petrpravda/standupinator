import OpenAI from 'openai';
import { Commit } from './gitService';

const SYSTEM_PROMPT = `You are a helpful assistant that converts a list of git commits into a concise daily standup update.
The standup should be written in first person, be brief, and use plain language.
Structure the output as:
- **What I did**: a short summary of the work completed
- **What I plan to do next**: reasonable next steps inferred from the commit history (if unclear, state that)
- **Blockers**: any blockers mentioned in commit messages (if none, state "None")

Do not include commit hashes or technical jargon that non-engineers would not understand.`;

export class AiService {
    private readonly client: OpenAI;
    private readonly model: string;

    constructor(apiKey: string, model: string) {
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }

    async generateStandup(commits: Commit[]): Promise<string> {
        const commitList = commits
            .map(c => `- [${c.date.length >= 10 ? c.date.substring(0, 10) : c.date}] ${c.author}: ${c.message}`)
            .join('\n');

        const userMessage = `Here are my recent git commits:\n\n${commitList}\n\nPlease generate a standup update.`;

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            max_tokens: 512,
            temperature: 0.4,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI returned an empty response.');
        }

        return content.trim();
    }
}
