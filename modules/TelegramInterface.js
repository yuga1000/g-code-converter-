const TelegramBot = require('node-telegram-bot-api');

class TelegramInterface {
    constructor(system) {
        this.system = system;
        this.logger = system.logger.create('TELEGRAM');
        this.config = system.config;
        this.isConnected = false;
        this.bot = null;
        this.chatId = null;
    }

    async initialize() {
        return { success: true, message: 'Telegram initialized' };
    }

    async start() {
        try {
            const token = this.config.get('TELEGRAM_BOT_TOKEN');
            this.bot = new TelegramBot(token, { polling: true });
            
            this.bot.on('message', (msg) => {
                this.bot.sendMessage(msg.chat.id, '🚀 Ghostline V4.0 is working!');
            });
            
            this.isConnected = true;
            return { success: true, message: 'Telegram started' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async stop() {
        if (this.bot) this.bot.stopPolling();
        return { success: true };
    }

    async sendNotification(text) {
        if (this.chatId && this.bot) {
            await this.bot.sendMessage(this.chatId, text);
        }
    }
}
