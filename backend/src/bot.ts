// @ts-ignore
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.TELEGRAM_WEB_APP_URL || 'https://your-mini-app-url.com';
const ADMIN_ID = 399207185;

const CONFIG_PATH = path.join(process.cwd(), 'src', 'bot_config.json');

let botConfig: any = {
    welcomeHtml: 'Welcome to the Trading Terminal! 🚀\n\nClick the button below to open the Mini App and start trading.',
    buttonText: 'Launch Pro Hub 📈',
    buttonStyle: 'primary',       // 'primary' | 'success' | 'danger'
    buttonIconEmojiId: ''         // custom_emoji_id for button icon
};

const loadConfig = async () => {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(data);
        botConfig = { ...botConfig, ...parsed };
    } catch (e) {
        await saveConfig();
    }
};

const saveConfig = async () => {
    try {
        await fs.writeFile(CONFIG_PATH, JSON.stringify(botConfig, null, 2));
    } catch (e) {
        console.error('Failed to save bot config:', e);
    }
};

function escapeHtml(str: string) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtmlFromEntities(text: string, entities: any[]) {
    if (!entities || entities.length === 0) return escapeHtml(text);
    
    const sorted = [...entities].sort((a, b) => a.offset - b.offset);
    
    let html = '';
    let lastIndex = 0;
    
    for (const entity of sorted) {
        if (entity.offset < lastIndex) continue;
        
        html += escapeHtml(text.substring(lastIndex, entity.offset));
        const entityText = text.substring(entity.offset, entity.offset + entity.length);
        
        if (entity.type === 'custom_emoji') {
            html += `<tg-emoji emoji-id="${entity.custom_emoji_id}">${escapeHtml(entityText)}</tg-emoji>`;
        } else if (entity.type === 'bold') {
            html += `<b>${escapeHtml(entityText)}</b>`;
        } else if (entity.type === 'italic') {
            html += `<i>${escapeHtml(entityText)}</i>`;
        } else if (entity.type === 'text_link') {
            html += `<a href="${entity.url}">${escapeHtml(entityText)}</a>`;
        } else if (entity.type === 'strikethrough') {
            html += `<s>${escapeHtml(entityText)}</s>`;
        } else if (entity.type === 'underline') {
            html += `<u>${escapeHtml(entityText)}</u>`;
        } else {
            html += escapeHtml(entityText);
        }
        
        lastIndex = entity.offset + entity.length;
    }
    
    html += escapeHtml(text.substring(lastIndex));
    return html;
}

// Extract first custom_emoji_id from entities
function extractFirstCustomEmojiId(entities: any[]): string {
    if (!entities) return '';
    const found = entities.find((e: any) => e.type === 'custom_emoji');
    return found ? found.custom_emoji_id : '';
}

export const initBot = async () => {
    if (!token) return;

    await loadConfig();

    const bot = new TelegramBot(token, {
        polling: {
            autoStart: true,
            params: {
                timeout: 10
            }
        },
        request: {
            family: 4,
            timeout: 30000
        } as any
    });
    
    bot.on('polling_error', (error: any) => {
        console.error('🤖 Telegram Bot polling error:', error.message || error);
    });

    bot.on('error', (error: any) => {
        console.error('🤖 Telegram Bot error:', error.message || error);
    });

    try {
        await bot.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: botConfig.buttonText,
                web_app: { url: webAppUrl }
            }
        });
        console.log('🤖 Telegram Bot: Menu button updated to:', webAppUrl);
    } catch (e: any) {
        console.error('🤖 Telegram Bot: Failed to set menu button:', e.message || e);
    }

    console.log('🤖 Telegram Bot started');

    // ── /start ──
    bot.onText(/\/start/, (msg: any) => {
        console.log(`🤖 Telegram Bot: Received /start command from chat ID: ${msg.chat.id}, user: ${msg.from?.username || msg.from?.first_name}`);
        const chatId = msg.chat.id;
        
        const buttonObj: any = { 
            text: botConfig.buttonText || 'Launch Pro Hub 📈', 
            web_app: { url: webAppUrl }
        };
        
        if (botConfig.buttonIconEmojiId) {
            buttonObj.icon_custom_emoji_id = botConfig.buttonIconEmojiId;
        }

        const welcomeText = botConfig.welcomeHtml || 'Welcome to Termax Trading Terminal! 🚀\n\nClick the button below to open the Mini App and start trading.';

        bot.sendMessage(chatId, welcomeText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[buttonObj]]
            }
        }).catch((err: any) => {
            console.error('🤖 Telegram Bot: Failed to send /start message:', err.message || err);
            // Fallback without HTML parse mode if HTML parsing failed
            bot.sendMessage(chatId, welcomeText.replace(/<[^>]*>/g, ''), {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Launch Pro Hub 📈', web_app: { url: webAppUrl } }]]
                }
            }).catch((e: any) => console.error('🤖 Fallback sendMessage error:', e));
        });
    });

    // ── /setmsg (reply to a message) ──
    bot.onText(/^\/setmsg/, async (msg: any) => {
        if (msg.from.id !== ADMIN_ID) return;

        if (!msg.reply_to_message) {
            bot.sendMessage(msg.chat.id, '💡 Send your welcome message normally (with premium emojis), then reply to it with /setmsg');
            return;
        }

        const targetText = msg.reply_to_message.text || '';
        const targetEntities = msg.reply_to_message.entities || [];

        botConfig.welcomeHtml = buildHtmlFromEntities(targetText, targetEntities);
        await saveConfig();
        
        bot.sendMessage(msg.chat.id, '✅ Welcome message saved:\n\n' + botConfig.welcomeHtml, {
            parse_mode: 'HTML'
        });
    });

    // ── /setbtn (reply to a message) ──
    // Gets button text + extracts first premium emoji for icon
    bot.onText(/^\/setbtn/, async (msg: any) => {
        if (msg.from.id !== ADMIN_ID) return;

        if (!msg.reply_to_message) {
            bot.sendMessage(msg.chat.id, '💡 Send your button text normally (with premium emojis), then reply to it with /setbtn');
            return;
        }

        const replyText = msg.reply_to_message.text || '';
        const replyEntities = msg.reply_to_message.entities || [];

        // Extract first custom emoji for icon_custom_emoji_id
        const emojiId = extractFirstCustomEmojiId(replyEntities);
        
        // Remove premium emoji characters from button text 
        // (they can't render in button text, only as icon via icon_custom_emoji_id)
        let cleanText = replyText;
        if (replyEntities && replyEntities.length > 0) {
            // Remove custom_emoji characters from text (reverse order to preserve offsets)
            const customEmojiEntities = replyEntities
                .filter((e: any) => e.type === 'custom_emoji')
                .sort((a: any, b: any) => b.offset - a.offset);
            
            for (const entity of customEmojiEntities) {
                cleanText = cleanText.substring(0, entity.offset) + cleanText.substring(entity.offset + entity.length);
            }
            cleanText = cleanText.trim();
        }
        
        botConfig.buttonText = cleanText || replyText;
        botConfig.buttonIconEmojiId = emojiId;
        await saveConfig();

        let confirmMsg = '✅ Button text changed:\n\n' + (cleanText || replyText);
        if (emojiId) {
            confirmMsg += '\n\n🎨 Premium custom emoji set as button icon!';
        }
        bot.sendMessage(msg.chat.id, confirmMsg);
    });

    // ── /setbtncolor ──
    bot.onText(/\/setbtncolor (primary|success|danger)/, async (msg: any, match: any) => {
        if (msg.from.id !== ADMIN_ID) return;
        botConfig.buttonStyle = match[1];
        await saveConfig();

        const colorNames: any = { primary: 'Blue (Primary)', success: 'Green (Success)', danger: 'Red (Danger)' };
        bot.sendMessage(msg.chat.id, '✅ Glass button color changed to: ' + colorNames[match[1]]);
    });

    // ── /admin ──
    bot.on('message', (msg: any) => {
        const chatId = msg.chat.id;
        const text = msg.text || '';

        if (msg.from.id === ADMIN_ID && text === '/admin') {
            const guide = 
                `🛠 Advanced Bot Configuration\n\n` +

                `📝 Change Welcome Message:\n` +
                `Send the message normally (with premium emojis), then reply to it with:\n/setmsg\n\n` +

                `🔘 Change Button Text & Icon:\n` +
                `Send the button text normally (with premium emojis), then reply to it with:\n/setbtn\n` +
                `The first premium emoji will be set as the button icon.\n\n` +

                `🎨 Change Button Color:\n/setbtncolor primary  (Blue)\n/setbtncolor success  (Green)\n/setbtncolor danger   (Red)`;

            bot.sendMessage(chatId, guide);
            return;
        }

        if (!text.startsWith('/')) {
            bot.sendMessage(chatId, 'Please use the /start command to open the application.');
        }
    });
};
