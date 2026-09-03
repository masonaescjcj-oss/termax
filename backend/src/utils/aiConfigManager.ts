/**
 * The AI provider configuration the admin console edits.
 *
 * Where this lives matters more than it looks. It used to be a JSON file
 * beside the source, written by the console at runtime. A redeploy rebuilds
 * the container, the file goes with it, and the next `loadAIConfig` falls
 * back to AI_API_KEY from the environment — the old key the admin replaced
 * precisely because it had stopped working. Nothing said so: the console
 * still showed a key as stored, and users still got errors. Two instances
 * would not have agreed either.
 *
 * It is a row in `app_settings` now. That is shared between instances,
 * survives a deploy, and is the same answer everywhere. The old file is
 * still read once, as a migration path, so an existing deployment does not
 * lose its key the moment this ships.
 *
 * The config is read on the hot path of every AI request, so it is cached
 * in memory for a few seconds; saving busts the cache immediately, which is
 * what makes a key change take effect on the very next message.
 */

import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { supabase } from '../config/supabase';

dotenv.config();

/** The legacy location. Read, never written. */
const LEGACY_PATH = path.join(process.cwd(), 'src', 'ai_config.json');

const SETTINGS_KEY = 'ai_provider';

export interface AIConfig {
    activeProvider: string;
    apiKey: string;
    baseUrl: string;
    modelName: string;
    fallbackApiKey?: string;
    fallbackBaseUrl?: string;
    fallbackModelName?: string;
}

const DEFAULT_CONFIG: AIConfig = {
    activeProvider: 'nara',
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: 'https://router.bynara.id/v1',
    modelName: 'mistral-medium-3-5',
    fallbackApiKey: process.env.OPENAI_API_KEY || '',
    fallbackBaseUrl: 'https://api.openai.com/v1',
    fallbackModelName: 'gpt-4o',
};

/**
 * Every AI message reads this, so an uncached read would be a Supabase
 * round trip per message. A few seconds is short enough that a key change
 * is effectively immediate even without the explicit bust below.
 */
const CACHE_TTL_MS = 5_000;
let cache: { at: number; config: AIConfig } | null = null;

/** Where the answer came from, for the console to show. */
export type ConfigSource = 'database' | 'legacy-file' | 'environment';
let lastSource: ConfigSource = 'environment';

export const configSource = (): ConfigSource => lastSource;

/** Drop the cache. Called after a save, and available to tests. */
export const invalidateAIConfigCache = () => { cache = null; };

export const loadAIConfig = async (): Promise<AIConfig> => {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.config;

    let stored: Partial<AIConfig> | null = null;
    let source: ConfigSource = 'environment';

    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', SETTINGS_KEY)
            .maybeSingle();
        if (!error && data?.value && Object.keys(data.value).length) {
            stored = data.value as Partial<AIConfig>;
            source = 'database';
        }
    } catch {
        // No table yet, or the database is unreachable. Fall through — the
        // AI must keep working off the environment while a migration is
        // still to be run.
    }

    if (!stored) {
        try {
            const raw = await fs.readFile(LEGACY_PATH, 'utf8');
            stored = JSON.parse(raw) as Partial<AIConfig>;
            source = 'legacy-file';
        } catch {
            // Neither the row nor the file: the environment is the answer.
        }
    }

    if (stored) {
        // A blank key in stored config means "fall back to the environment",
        // so credentials never have to live in a committed file.
        if (!stored.apiKey) delete stored.apiKey;
        if (!stored.fallbackApiKey) delete stored.fallbackApiKey;
    }

    const config = { ...DEFAULT_CONFIG, ...(stored ?? {}) };
    lastSource = source;
    cache = { at: Date.now(), config };
    return config;
};

export const saveAIConfig = async (
    config: AIConfig,
    actor?: { id?: string; username?: string },
): Promise<void> => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({
            key: SETTINGS_KEY,
            value: config,
            updated_at: new Date().toISOString(),
            updated_by: isUuid(actor?.id) ? actor!.id : null,
            updated_by_username: actor?.username ?? null,
        }, { onConflict: 'key' });

    if (error) {
        // Saying it saved when it did not is how an admin ends up believing
        // a dead key was replaced.
        throw new Error(
            `Could not save the configuration: ${error.message}. ` +
            'If the app_settings table is missing, run migration 014_app_settings.sql.'
        );
    }

    invalidateAIConfigCache();
};

function isUuid(v: unknown): boolean {
    return typeof v === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
