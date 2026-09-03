/**
 * Ask a provider whether it is actually going to work.
 *
 * Saving a key and finding out from a user's complaint is the loop this
 * closes. The console can send a candidate configuration here and get back
 * the provider's real answer — including the distinction that matters most,
 * between a key the provider rejects and a model it has never heard of.
 */

import OpenAI from 'openai';
import { describe } from '../aiHealth';
import { AIConfig } from '../../utils/aiConfigManager';

export type ProbeResult = {
    ok: boolean;
    message: string;
    latencyMs: number;
    /** What the model actually said, when it said anything. */
    sample?: string;
};

/**
 * One tiny completion. Cheap on purpose: a handful of tokens is enough to
 * prove the key is accepted and the model exists, and an admin may press
 * the button repeatedly.
 */
export async function probeProvider(
    cfg: Pick<AIConfig, 'apiKey' | 'baseUrl' | 'modelName'>,
    timeoutMs = 20_000,
): Promise<ProbeResult> {
    const started = Date.now();

    if (!cfg.apiKey) {
        return { ok: false, message: 'No API key to test.', latencyMs: 0 };
    }
    if (!cfg.baseUrl || !cfg.modelName) {
        return { ok: false, message: 'A base URL and a model name are both needed.', latencyMs: 0 };
    }

    try {
        const client = new OpenAI({
            apiKey: cfg.apiKey,
            baseURL: cfg.baseUrl,
            timeout: timeoutMs,
            maxRetries: 0,
        });

        const completion: any = await client.chat.completions.create({
            model: cfg.modelName,
            messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
            max_tokens: 5,
            temperature: 0,
        });

        const sample = String(completion?.choices?.[0]?.message?.content ?? '').trim();
        const latencyMs = Date.now() - started;

        // A 200 with no content is not a working provider — some gateways
        // answer that way for a model they cannot route.
        if (!sample) {
            return {
                ok: false,
                latencyMs,
                message: 'The provider answered but returned nothing. Check the model name.',
            };
        }

        return { ok: true, latencyMs, message: 'The provider answered.', sample: sample.slice(0, 80) };
    } catch (err: any) {
        return { ok: false, latencyMs: Date.now() - started, message: describe(err) };
    }
}
