// Telegram Interface V4.0 - Real API Implementation
// File: modules/TelegramInterface.js

const TelegramBot = require('node-telegram-bot-api');

class TelegramInterface {
    constructor(system) {
        this.system = system;
        this.logger = system.logger.create('TELEGRAM');
        this.config = system.config;
        this.security = system.security;
        
        this.version = '4.0.0';
        this.bot = null;
        this.chatId = null;
        this.isConnected = false;
        this.messageHistory = [];
        this.rateLimitQueue = [];
        
        // Rate limiting
        this.messageRate = {
            maxMessages: 30,
            timeWindow: 60000, // 1 minute
            messageCount: 0,
            windowStart: Date.now()
        };
        
        // Command handlers
        this.commandHandlers = new Map();
        this.callbackHandlers = new Map();
        
        // Message templates
        this.templates = {
            unauthorized: '🚫 Unauthorized access detected',
            error: '❌ Command failed: {error}',
            success: '✅ {message}',
            warning: '⚠️ {message}',
            info: 'ℹ️ {message}'
        };
        
        // Setup handlers
        this.setupCommands();
        this.setupCallbacks();
        
        this.logger.info('[◉] TelegramInterface V4.0 initialized');
    }

    async initialize() {
        try {
            this.logger.info('[▸] Initializing Telegram interface...');
            
            // Validate configuration
            if (!this.validateTelegramConfig()) {
                throw new Error('Telegram configuration validation failed');
            }
            
            this.logger.success('[✓] Telegram interface initialized');
            return { success: true, message: 'Telegram interface ready' };
            
        } catch (error) {
            this.logger.error(`[✗] Telegram initialization failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    validateTelegramConfig() {
        const token = this.config.get('TELEGRAM_BOT_TOKEN');
        const chatId = this.config.get('TELEGRAM_CHAT_ID');
        
        if (!token) {
            this.logger.error('[✗] TELEGRAM_BOT_TOKEN not configured');
            return false;
        }
        
        if (!chatId) {
            this.logger.warn('[--] TELEGRAM_CHAT_ID not configured - will accept first message');
        }
        
        // Validate token format
        if (!this.security.validateTelegramToken(token)) {
            this.logger.error('[✗] Invalid Telegram bot token format');
            return false;
        }
        
        return true;
    }

    async start() {
        if (this.isConnected) {
            return { success: false, message: 'Telegram interface already connected' };
        }
        
        try {
            const botToken = this.config.get('TELEGRAM_BOT_TOKEN');
            this.chatId = this.config.get('TELEGRAM_CHAT_ID');
            
            // Create real Telegram bot instance
            this.bot = new TelegramBot(botToken, { 
                polling: {
                    interval: 1000,
                    autoStart: true,
                    params: {
                        timeout: 10
                    }
                }
            });
            
            this.setupEventHandlers();
            this.startRateLimitManager();
            
            // Test bot connection
            const botInfo = await this.bot.getMe();
            this.logger.success(`[✓] Connected to bot: ${botInfo.first_name} (@${botInfo.username})`);
            
            this.isConnected = true;
            
            // Log security event
            await this.logger.logSecurity('telegram_connected', {
                botName: botInfo.first_name,
                botUsername: botInfo.username,
                chatId: this.chatId ? this.security.hashForLogging(this.chatId) : null
            });
            
            return { success: true, message: 'Telegram interface started successfully' };
            
        } catch (error) {
            this.logger.error(`[✗] Telegram connection failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    setupEventHandlers() {
        // Handle messages
        this.bot.on('message', (msg) => {
            this.handleMessage(msg).catch(error => {
                this.logger.error(`[✗] Message handling error: ${error.message}`);
            });
        });
        
        // Handle callback queries (inline buttons)
        this.bot.on('callback_query', (query) => {
            this.handleCallback(query).catch(error => {
                this.logger.error(`[✗] Callback handling error: ${error.message}`);
            });
        });
        
        // Handle errors
        this.bot.on('error', (error) => {
            this.logger.error(`[✗] Telegram bot error: ${error.message}`);
        });
        
        // Handle polling errors
        this.bot.on('polling_error', (error) => {
            this.logger.error(`[✗] Telegram polling error: ${error.message}`);
        });
        
        this.logger.debug('[◎] Real Telegram event handlers configured');
    }

    startRateLimitManager() {
        setInterval(() => {
            this.resetRateLimit();
        }, this.messageRate.timeWindow);
    }

    resetRateLimit() {
        this.messageRate.messageCount = 0;
        this.messageRate.windowStart = Date.now();
        
        // Process queued messages
        this.processQueuedMessages();
    }

    async processQueuedMessages() {
        while (this.rateLimitQueue.length > 0 && this.canSendMessage()) {
            const queuedMessage = this.rateLimitQueue.shift();
            await this.sendMessageNow(queuedMessage.chatId, queuedMessage.text, queuedMessage.options);
        }
    }

    canSendMessage() {
        return this.messageRate.messageCount < this.messageRate.maxMessages;
    }

    setupCommands() {
        this.commandHandlers.set('/start', this.handleStart.bind(this));
        this.commandHandlers.set('/menu', this.handleMenu.bind(this));
        this.commandHandlers.set('/status', this.handleStatus.bind(this));
        this.commandHandlers.set('/metrics', this.handleMetrics.bind(this));
        this.commandHandlers.set('/help', this.handleHelp.bind(this));
        this.commandHandlers.set('/emergency', this.handleEmergency.bind(this));
        this.commandHandlers.set('/security', this.handleSecurity.bind(this));
        this.commandHandlers.set('/logs', this.handleLogs.bind(this));
    }

    setupCallbacks() {
        // Main menu callbacks
        this.callbackHandlers.set('main_menu', this.showMainMenu.bind(this));
        this.callbackHandlers.set('status_menu', this.showStatusMenu.bind(this));
        this.callbackHandlers.set('control_menu', this.showControlMenu.bind(this));
        this.callbackHandlers.set('metrics_menu', this.showMetricsMenu.bind(this));
        this.callbackHandlers.set('security_menu', this.showSecurityMenu.bind(this));
        
        // Module control callbacks
        this.callbackHandlers.set('harvester_start', this.startHarvester.bind(this));
        this.callbackHandlers.set('harvester_stop', this.stopHarvester.bind(this));
        this.callbackHandlers.set('analyzer_start', this.startAnalyzer.bind(this));
        this.callbackHandlers.set('analyzer_stop', this.stopAnalyzer.bind(this));
        this.callbackHandlers.set('validator_start', this.startValidator.bind(this));
        this.callbackHandlers.set('validator_stop', this.stopValidator.bind(this));
        
        // Utility callbacks
        this.callbackHandlers.set('refresh_status', this.refreshStatus.bind(this));
        this.callbackHandlers.set('emergency_stop', this.emergencyStop.bind(this));
        this.callbackHandlers.set('security_report', this.getSecurityReport.bind(this));
    }

    async handleMessage(msg) {
        try {
            const chatId = msg.chat.id;
            const text = msg.text;
            const userId = msg.from.id;
            
            // Security: Store and validate chat ID
            if (!this.chatId) {
                this.chatId = chatId.toString();
                this.config.set('TELEGRAM_CHAT_ID', this.chatId);
                this.logger.security('new_chat_registered', { 
                    chatId: this.security.hashForLogging(this.chatId),
                    username: msg.from.username || 'unknown'
                });
            }
            
            // Security: Validate authorized user
            if (chatId.toString() !== this.chatId.toString()) {
                await this.handleUnauthorizedAccess(chatId, userId, text);
                return;
            }
            
            this.logger.info(`[▸] Received command: ${text}`);
            
            // Handle commands
            if (text && text.startsWith('/')) {
                const command = text.split(' ')[0];
                const handler = this.commandHandlers.get(command);
                
                if (handler) {
                    await handler(msg);
                } else {
                    await this.sendMessage(chatId, this.templates.error.replace('{error}', `Unknown command: ${command}`));
                }
            } else {
                await this.handleRegularMessage(msg);
            }
            
        } catch (error) {
            this.logger.error(`[✗] Message handling error: ${error.message}`);
            await this.sendMessage(msg.chat.id, this.templates.error.replace('{error}', 'Internal error occurred'));
        }
    }

    async handleCallback(query) {
        try {
            const callbackData = query.data;
            const handler = this.callbackHandlers.get(callbackData);
            
            if (handler) {
                await handler(query);
                await this.bot.answerCallbackQuery(query.id);
            } else {
                await this.bot.answerCallbackQuery(query.id, {
                    text: 'Unknown action',
                    show_alert: false
                });
            }
        } catch (error) {
            this.logger.error(`[✗] Callback handling error: ${error.message}`);
            await this.bot.answerCallbackQuery(query.id, {
                text: 'Error processing request',
                show_alert: true
            });
        }
    }

    async handleUnauthorizedAccess(chatId, userId, text) {
        // Log security incident
        await this.logger.logSecurity('unauthorized_telegram_access', {
            chatId: this.security.hashForLogging(chatId.toString()),
            userId: this.security.hashForLogging(userId.toString()),
            command: text,
            timestamp: new Date().toISOString()
        });
        
        // Send warning to unauthorized user
        try {
            await this.sendMessage(chatId, this.templates.unauthorized);
        } catch (error) {
            this.logger.error(`[✗] Failed to send unauthorized message: ${error.message}`);
        }
        
        // Notify authorized user if connected
        if (this.isConnected && this.chatId) {
            await this.sendMessage(this.chatId, `🚨 SECURITY ALERT: Unauthorized access attempt\nUser: ${userId}\nCommand: ${text}`);
        }
    }

    async handleStart(msg) {
        const welcomeMessage = this.createWelcomeMessage();
        const keyboard = this.createMainMenuKeyboard();
        
        await this.sendMessage(msg.chat.id, welcomeMessage, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'HTML'
        });
    }

    async handleMenu(msg) {
        await this.showMainMenu({ message: msg });
    }

    async handleStatus(msg) {
        await this.showStatusMenu({ message: msg });
    }

    async handleMetrics(msg) {
        await this.showMetricsMenu({ message: msg });
    }

    async handleSecurity(msg) {
        await this.showSecurityMenu({ message: msg });
    }

    async handleHelp(msg) {
        const helpMessage = this.createHelpMessage();
        await this.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'HTML' });
    }

    async handleEmergency(msg) {
        const confirmationId = this.security.generateSecureId();
        await this.sendMessage(msg.chat.id,
            `⚠️ EMERGENCY STOP CONFIRMATION\n\n` +
            `This will stop ALL system operations.\n` +
            `Type: /confirm ${confirmationId.substring(0, 8)} to proceed`
        );
        
        // Store confirmation requirement
        this.pendingConfirmations = this.pendingConfirmations || new Map();
        this.pendingConfirmations.set(confirmationId.substring(0, 8), {
            action: 'emergency_stop',
            timestamp: Date.now(),
            expires: Date.now() + 60000 // 1 minute
        });
    }

    async handleLogs(msg) {
        try {
            const logStats = await this.logger.getLogStats();
            if (logStats) {
                const message = `📊 LOG STATISTICS\n\n` +
                    `📁 Total Files: ${logStats.totalLogFiles}\n` +
                    `💾 Total Size: ${(logStats.totalLogSize / 1024 / 1024).toFixed(2)} MB\n` +
                    `🔒 Security Events: ${logStats.securityEvents}\n` +
                    `💼 Business Events: ${logStats.businessEvents}\n` +
                    `📅 Oldest Log: ${logStats.oldestLog ? new Date(logStats.oldestLog).toLocaleDateString() : 'N/A'}\n` +
                    `🕐 Newest Log: ${logStats.newestLog ? new Date(logStats.newestLog).toLocaleDateString() : 'N/A'}`;
                
                await this.sendMessage(msg.chat.id, message);
            } else {
                await this.sendMessage(msg.chat.id, '❌ Unable to retrieve log statistics');
            }
        } catch (error) {
            await this.sendMessage(msg.chat.id, `❌ Error retrieving logs: ${error.message}`);
        }
    }

    async handleRegularMessage(msg) {
        const text = msg.text.toLowerCase();
        
        if (text.includes('status')) {
            await this.handleStatus(msg);
        } else if (text.includes('help')) {
            await this.handleHelp(msg);
        } else {
            await this.sendMessage(msg.chat.id, 
                '💡 Use /menu for navigation or try these commands:\n' +
                '/start - Main menu\n' +
                '/status - System status\n' +
                '/help - Command help'
            );
        }
    }

    createWelcomeMessage() {
        const status = this.system.isInitialized ? '🟢 Online' : '🟡 Starting';
        
        return `<b>🤖 GHOSTLINE V4.0 CONTROL CENTER</b>\n\n` +
            `🚀 <b>Advanced Revenue Generation Platform</b>\n\n` +
            `💰 <b>Active Revenue Streams:</b>\n` +
            `   ▸ Multi-platform Task Harvesting\n` +
            `   ▸ Advanced Blockchain Analysis\n` +
            `   ▸ Mnemonic Recovery System\n\n` +
            `🔧 <b>Enhanced Features:</b>\n` +
            `   ✅ Secure Credential Storage\n` +
            `   ✅ Real-time Performance Monitoring\n` +
            `   ✅ Smart Notification System\n` +
            `   ✅ Advanced Security Protection\n\n` +
            `📊 <b>System Status:</b> ${status}\n` +
            `🏷️ <b>Version:</b> ${this.system.version}\n` +
            `🔒 <b>Security:</b> Enhanced Protection Active\n\n` +
            `<i>Use the menu below for full system control</i>`;
    }

    createMainMenuKeyboard() {
        return [
            [
                { text: '📊 System Status', callback_data: 'status_menu' },
                { text: '🎛️ Control Panel', callback_data: 'control_menu' }
            ],
            [
                { text: '📈 Metrics Dashboard', callback_data: 'metrics_menu' },
                { text: '🔒 Security Center', callback_data: 'security_menu' }
            ],
            [
                { text: '🛑 Emergency Stop', callback_data: 'emergency_stop' }
            ]
        ];
    }

    createHelpMessage() {
        return `<b>🆘 GHOSTLINE V4.0 HELP</b>\n\n` +
            `<b>🎯 Quick Commands:</b>\n` +
            `/start - Show main control panel\n` +
            `/menu - Access navigation menu\n` +
            `/status - View system status\n` +
            `/metrics - Show performance metrics\n` +
            `/security - Security dashboard\n` +
            `/logs - View log statistics\n` +
            `/emergency - Emergency stop (requires confirmation)\n` +
            `/help - Show this help message\n\n` +
            `<b>🎛️ Navigation:</b>\n` +
            `✅ Use inline buttons for easy navigation\n` +
            `🔄 Real-time status updates\n` +
            `👆 One-click module control\n` +
            `💰 Live earnings tracking\n\n` +
            `<b>🔒 Security Features:</b>\n` +
            `✅ Secure credential storage\n` +
            `✅ Unauthorized access protection\n` +
            `✅ Activity monitoring\n` +
            `✅ Emergency stop protection\n\n` +
            `<b>⚡ All operations are logged and secured</b>`;
    }

    async showMainMenu(query) {
        const message = this.createWelcomeMessage();
        const keyboard = this.createMainMenuKeyboard();
        
        if (query.message) {
            await this.editMessage(query.message.chat.id, query.message.message_id, message, keyboard);
        } else {
            await this.sendMessage(this.chatId, message, { 
                reply_markup: { inline_keyboard: keyboard },
                parse_mode: 'HTML'
            });
        }
    }

    async showStatusMenu(query) {
        try {
            const status = this.system.getSystemStatus();
            const message = this.formatStatusMessage(status);
            const keyboard = this.createStatusKeyboard();
            
            if (query.message) {
                await this.editMessage(query.message.chat.id, query.message.message_id, message, keyboard);
            } else {
                await this.sendMessage(this.chatId, message, { 
                    reply_markup: { inline_keyboard: keyboard },
                    parse_mode: 'HTML'
                });
            }
        } catch (error) {
            const errorMsg = `❌ Error retrieving status: ${error.message}`;
            if (query.message) {
                await this.sendMessage(query.message.chat.id, errorMsg);
            } else {
                await this.sendMessage(this.chatId, errorMsg);
            }
        }
    }

    formatStatusMessage(status) {
        return `<b>📊 SYSTEM STATUS REPORT</b>\n\n` +
            `⏱️ <b>Runtime:</b> ${status.runtime}\n` +
            `🟢 <b>Status:</b> ${status.status}\n` +
            `🏷️ <b>Version:</b> ${status.version}\n` +
            `🔒 <b>Security:</b> ${status.security?.status || 'Active'} (${status.security?.events || 0} events)\n\n` +
            `<b>🌾 HARVESTER MODULE</b>\n` +
            `${status.modules?.harvester?.status || '[○] Not Available'}\n` +
            `📋 Active Tasks: ${status.modules?.harvester?.tasks || 0}\n` +
            `💰 Pending: ${(status.modules?.harvester?.earnings || 0).toFixed(4)} ETH\n\n` +
            `<b>🔍 ANALYZER MODULE</b>\n` +
            `${status.modules?.analyzer?.status || '[○] Not Available'}\n` +
            `👛 Wallets Analyzed: ${status.modules?.analyzer?.wallets || 0}\n` +
            `✨ Discoveries: ${status.modules?.analyzer?.discoveries || 0}\n\n` +
            `<b>💎 VALIDATOR MODULE</b>\n` +
            `${status.modules?.validator?.status || '[○] Not Available'}\n` +
            `✅ Validated: ${status.modules?.validator?.validated || 0}\n` +
            `💰 Positive Balances: ${status.modules?.validator?.found || 0}\n\n` +
            `<b>🤖 TELEGRAM MODULE</b>\n` +
            `${status.modules?.telegram?.status || '[○] Not Available'}\n\n` +
            `<i>🕐 Last Updated: ${new Date().toLocaleTimeString()}</i>`;
    }

    createStatusKeyboard() {
        return [
            [
                { text: '🔄 Refresh', callback_data: 'refresh_status' },
                { text: '🎛️ Control Panel', callback_data: 'control_menu' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'main_menu' },
                { text: '📈 Metrics', callback_data: 'metrics_menu' }
            ]
        ];
    }

    async showSecurityMenu(query) {
        try {
            const securityReport = this.system.security.generateSecurityReport();
            const message = this.formatSecurityMessage(securityReport);
            const keyboard = this.createSecurityKeyboard();
            
            if (query.message) {
                await this.editMessage(query.message.chat.id, query.message.message_id, message, keyboard);
            } else {
                await this.sendMessage(this.chatId, message, { 
                    reply_markup: { inline_keyboard: keyboard },
                    parse_mode: 'HTML'
                });
            }
        } catch (error) {
            const errorMsg = `❌ Error retrieving security report: ${error.message}`;
            if (query.message) {
                await this.sendMessage(query.message.chat.id, errorMsg);
            } else {
                await this.sendMessage(this.chatId, errorMsg);
            }
        }
    }

    formatSecurityMessage(report) {
        const level = this.system.security.getHealthStatus();
        const levelEmoji = {
            'excellent': '🟢',
            'good': '🟡', 
            'fair': '🟠',
            'poor': '🔴',
            'critical': '🚨'
        };
        
        return `<b>🔒 SECURITY DASHBOARD</b>\n\n` +
            `${levelEmoji[level]} <b>Security Level: ${level.toUpperCase()}</b>\n\n` +
            `<b>📊 Security Summary:</b>\n` +
            `🚨 Total Violations: ${report.summary.totalSecurityViolations}\n` +
            `🔐 Encryption Ops: ${report.summary.encryptionOperations}\n` +
            `🔓 Decryption Ops: ${report.summary.decryptionOperations}\n` +
            `🔄 Key Rotations: ${report.summary.keyRotations}\n` +
            `🕐 Last Rotation: ${report.summary.lastKeyRotation ? new Date(report.summary.lastKeyRotation).toLocaleDateString() : 'Never'}\n\n` +
            `<b>⚠️ Security Alerts:</b>\n` +
            `🔺 High Priority: ${report.alerts.highSeverityEvents}\n` +
            `📝 Recent Activities: ${report.alerts.recentSuspiciousActivities.length}\n\n` +
            `<b>💡 Recommendations: ${report.recommendations.length}</b>\n` +
            report.recommendations.slice(0, 3).map(rec => `• ${rec}`).join('\n') +
            `\n\n<i>🕐 Report Generated: ${new Date().toLocaleTimeString()}</i>`;
    }

    createSecurityKeyboard() {
        return [
            [
                { text: '📊 Security Report', callback_data: 'security_report' },
                { text: '🔄 Refresh', callback_data: 'security_menu' }
            ],
            [
                { text: '🏠 Main Menu', callback_data: 'main_menu' },
                { text: '📊 Status', callback_data: 'status_menu' }
            ]
        ];
    }

    // Module control methods
    async startHarvester(query) {
        try {
            const result = await this.system.executeCommand('start_harvester');
            const message = result.success ? 
                this.templates.success.replace('{message}', result.message) :
                this.templates.error.replace('{error}', result.message);
            
            await this.sendNotification(message);
            await this.showControlMenu(query);
        } catch (error) {
            await this.sendNotification(this.templates.error.replace('{error}', error.message));
        }
    }

    async stopHarvester(query) {
        try {
            const result = await this.system.executeCommand('stop_harvester');
            const message = result.success ? 
                this.templates.success.replace('{message}', result.message) :
                this.templates.error.replace('{error}', result.message);
            
            await this.sendNotification(message);
            await this.showControlMenu(query);
        } catch (error) {
            await this.sendNotification(this.templates.error.replace('{error}', error.message));
        }
    }

    async emergencyStop(query) {
        try {
            const result = await this.system.executeCommand('emergency_stop');
            await this.sendNotification(`🛑 EMERGENCY STOP EXECUTED\n${result.message}`);
            await this.showMainMenu(query);
        } catch (error) {
            await this.sendNotification(this.templates.error.replace('{error}', error.message));
        }
    }

    async sendMessage(chatId, text, options = {}) {
        if (!this.isConnected || !this.bot) {
            this.logger.warn('[--] Cannot send message: bot not connected');
            return false;
        }
        
        // Use provided chatId or default to stored chatId
        const targetChatId = chatId || this.chatId;
        if (!targetChatId) {
            this.logger.warn('[--] Cannot send message: no chat ID available');
            return false;
        }
        
        // Check rate limit
        if (!this.canSendMessage()) {
            this.rateLimitQueue.push({ chatId: targetChatId, text, options });
            this.logger.debug('[◎] Message queued due to rate limit');
            return false;
        }
        
        return await this.sendMessageNow(targetChatId, text, options);
    }

    async sendMessageNow(chatId, text, options = {}) {
        try {
            this.messageRate.messageCount++;
            
            // Sanitize message content
            const sanitizedText = this.logger.sanitizeMessage(text);
            
            // Send message via real Telegram API
            const sentMessage = await this.bot.sendMessage(chatId, sanitizedText, options);
            
            this.logger.debug(`[▸] Telegram message sent: ${sanitizedText.substring(0, 50)}...`);
            
            // Store in message history
            this.messageHistory.push({
                messageId: sentMessage.message_id,
                text: sanitizedText,
                timestamp: new Date().toISOString(),
                options: options
            });
            
            // Keep only last 100 messages
            if (this.messageHistory.length > 100) {
                this.messageHistory = this.messageHistory.slice(-100);
            }
            
            return true;
        } catch (error) {
            this.logger.error(`[✗] Failed to send message: ${error.message}`);
            return false;
        }
    }

    async editMessage(chatId, messageId, text, keyboard = null) {
        try {
            const sanitizedText = this.logger.sanitizeMessage(text);
            const options = { 
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML'
            };
            
            if (keyboard) {
                options.reply_markup = { inline_keyboard: keyboard };
            }
            
            await this.bot.editMessageText(sanitizedText, options);
            this.logger.debug(`[▸] Message edited: ${messageId}`);
            return true;
        } catch (error) {
            // If edit fails, send new message
            this.logger.debug(`[--] Edit failed, sending new message: ${error.message}`);
            await this.sendMessage(chatId, text, keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {});
            return false;
        }
    }

    async sendNotification(text) {
        await this.sendMessage(this.chatId, `📢 ${text}`);
    }

    async sendSystemMessage(text) {
        await this.sendMessage(this.chatId, `🤖 ${text}`);
    }

    async sendAlert(text) {
        await this.sendMessage(this.chatId, `🚨 ALERT: ${text}`);
    }

    async sendSuccess(text) {
        await this.sendMessage(this.chatId, `✅ ${text}`);
    }

    async stop() {
        try {
            if (this.bot) {
                await this.bot.stopPolling();
                this.isConnected = false;
                this.logger.success('[◯] Telegram interface stopped');
                
                // Log security event
                await this.logger.logSecurity('telegram_disconnected', {
                    uptime: this.bot.startTime ? Date.now() - this.bot.startTime.getTime() : 0
                });
            }
            return { success: true, message: 'Telegram
