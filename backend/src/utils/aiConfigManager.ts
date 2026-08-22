import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), 'src', 'ai_config.json');

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
    fallbackModelName: 'gpt-4o'
};

export const loadAIConfig = async (): Promise<AIConfig> => {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        const stored = JSON.parse(data) as Partial<AIConfig>;
        // A blank key in the config file means "fall back to the environment",
        // so credentials never have to live in a committed file.
        if (!stored.apiKey) delete stored.apiKey;
        if (!stored.fallbackApiKey) delete stored.fallbackApiKey;
        return { ...DEFAULT_CONFIG, ...stored };
    } catch (e) {
        await saveAIConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }
};

export const saveAIConfig = async (config: AIConfig): Promise<void> => {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
};
