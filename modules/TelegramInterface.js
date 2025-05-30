const TelegramBot = require('node-telegram-bot-api');

class TelegramInterface {
    constructor(system) {
        this.system = system;
        this.logger = system.logger.create('TELEGRAM');
        this.config = system.config;
        this.security = system.security;
        
        this.bot = null;
        this.chatId = null;
        this.isConnected = false;
        
        this.logger.info('[◉] TelegramInterface initialized');
    }

    async initialize() {
        this.logger.info('[▸] Initializing Telegram interface...');
        return { success: true, message: 'Telegram interface ready' };
    }

    async start() {
        try {
            const botToken = this.config.get('TELEGRAM_BOT_TOKEN');
            this.chatId = this.config.get('TELEGRAM_CHAT_ID');
            
            if (!botToken) {
                throw new Error('TELEGRAM_BOT_TOKEN not configured');
            }
            
            this.bot = new TelegramBot(botToken, { polling: true });
            
            // Handle messages
            this.bot.on('message', async (msg) => {
                try {
                    await this.handleMessage(msg);
                } catch (error) {
                    this.logger.error(`Message error: ${error.message}`);
                }
            });
            
            // Handle callback queries
            this.bot.on('callback_query', async (query) => {
                try {
                    await this.handleCallback(query);
                } catch (error) {
                    this.logger.error(`Callback error: ${error.message}`);
                }
            });
            
            // Handle errors
            this.bot.on('error', (error) => {
                this.logger.error(`Bot error: ${error.message}`);
            });
            
            this.isConnected = true;
            this.logger.success('[✓] Telegram bot connected');
            
            return { success: true, message: 'Telegram interface started' };
            
        } catch (error) {
            this.logger.error(`[✗] Telegram start failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    async handleMessage(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;
        
        // Store chat ID if not set
        if (!this.chatId) {
            this.chatId = chatId.toString();
            this.config.set('TELEGRAM_CHAT_ID', this.chatId);
        }
        
        // Security check
        if (chatId.toString() !== this.chatId.toString()) {
            await this.bot.sendMessage(chatId, '🚫 Unauthorized access');
            return;
        }
        
        this.logger.info(`Received: ${text}`);
        
        // Handle commands
        if (text === '/start') {
            await this.handleStart(msg);
        } else if (text === '/status') {
            await this.handleStatus(msg);
        } else if (text === '/help') {
            await this.handleHelp(msg);
        } else if (text === '/menu') {
            await this.handleMenu(msg);
        } else {
            await this.bot.sendMessage(chatId, 
                '🤖 Ghostline V4.0 is running!\n\n' +
                'Commands:\n' +
                '/start - Main menu\n' +
                '/status - System status\n' +
                '/help - Help'
            );
        }
    }

    async handleCallback(query) {
        const data = query.data;
        
        if (data === 'status') {
            await this.handleStatus(query.message);
        } else if (data === 'start_harvester') {
            await this.startModule('harvester', query);
        } else if (data === 'stop_harvester') {
            await this.stopModule('harvester', query);
        }
        
        await this.bot.answerCallbackQuery(query.id);
    }

    async handleStart(msg) {
        const keyboard = [
            [
                { text: '📊 Status', callback_data: 'status' },
                { text: '🎛️ Control', callback_data: 'control' }
            ],
            [
                { text: '🌾 Start Harvester', callback_data: 'start_harvester' },
                { text: '🛑 Stop Harvester', callback_data: 'stop_harvester' }
            ]
        ];
        
        await this.bot.sendMessage(msg.chat.id, 
            '🚀 <b>GHOSTLINE V4.0</b>\n\n' +
            '💰 Advanced Revenue Generation System\n\n' +
            '📊 Status: Online\n' +
            '🔒 Security: Active\n\n' +
            'Choose an option below:', 
            {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
            }
        );
    }

    async handleStatus(msg) {
        try {
            const status = this.system.getSystemStatus();
            
            const message = 
                '📊 <b>SYSTEM STATUS</b>\n\n' +
                `⏱️ Runtime: ${status.runtime || 'N/A'}\n` +
                `🟢 Status: ${status.status || 'Unknown'}\n` +
                `🏷️ Version: ${status.version || 'N/A'}\n\n` +
                `🌾 Harvester: ${status.modules?.harvester?.status || 'N/A'}\n` +
                `🔍 Analyzer: ${status.modules?.analyzer?.status || 'N/A'}\n` +
                `💎 Validator: ${status.modules?.validator?.status || 'N/A'}\n\n` +
                `💰 Earnings: ${(status.modules?.harvester?.earnings || 0).toFixed(4)} ETH`;
            
            await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
            
        } catch (error) {
            await this.bot.sendMessage(msg.chat.id, '❌ Error getting status');
        }
    }

    async handleHelp(msg) {
        const helpText = 
            '🆘 <b>HELP</b>\n\n' +
            '<b>Commands:</b>\n' +
            '/start - Main control panel\n' +
            '/status - System status\n' +
            '/help - This help message\n' +
            '/menu - Navigation menu\n\n' +
            '<b>Features:</b>\n' +
            '🌾 Task Harvesting\n' +
            '🔍 Wallet Analysis\n' +
            '💎 Mnemonic Validation\n' +
            '🔒 Secure Operations';
        
        await this.bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'HTML' });
    }

    async handleMenu(msg) {
        await this.handleStart(msg);
    }

    async startModule(moduleName, query) {
        try {
            const result = await this.system.executeCommand(`start_${moduleName}`);
            const message = result.success ? 
                `✅ ${moduleName} started: ${result.message}` :
                `❌ Failed to start ${moduleName}: ${result.message}`;
            
            await this.bot.sendMessage(query.message.chat.id, message);
            
        } catch (error) {
            await this.bot.sendMessage(query.message.chat.id, `❌ Error: ${error.message}`);
        }
    }

    async stopModule(moduleName, query) {
        try {
            const result = await this.system.executeCommand(`stop_${moduleName}`);
            const message = result.success ? 
                `✅ ${moduleName} stopped: ${result.message}` :
                `❌ Failed to stop ${moduleName}: ${result.message}`;
            
            await this.bot.sendMessage(query.message.chat.id, message);
            
        } catch (error) {
            await this.bot.sendMessage(query.message.chat.id, `❌ Error: ${error.message}`);
        }
    }

    async sendMessage(chatId, text, options = {}) {
        if (!this.bot || !this.isConnected) return false;
        
        try {
            await this.bot.sendMessage(chatId || this.chatId, text, options);
            return true;
        } catch (error) {
            this.logger.error(`Send message failed: ${error.message}`);
            return false;
        }
    }

    async sendNotification(text) {
        if (this.chatId) {
            await this.sendMessage(this.chatId, `📢 ${text}`);
        }
    }

    async sendSystemMessage(text) {
        if (this.chatId) {
            await this.sendMessage(this.chatId, `🤖 ${text}`);
        }
    }

    async sendAlert(text) {
        if (this.chatId) {
            await this.sendMessage(this.chatId, `🚨 ${text}`);
        }
    }

    async sendSuccess(text) {
        if (this.chatId) {
            await this.sendMessage(this.chatId, `✅ ${text}`);
        }
    }

    async stop() {
        try {
            if (this.bot) {
                await this.bot.stopPolling();
                this.isConnected = false;
                this.logger.success('[◯] Telegram interface stopped');
            }
            return { success: true, message: 'Telegram interface stopped' };
        } catch (error) {
            this.logger.error(`Stop failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }
}

module.exports = TelegramInterface;
