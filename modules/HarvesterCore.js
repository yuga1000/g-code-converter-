// ✅ ЗАМЕНИТЬ в начале HarvesterCore.js

// HarvesterCore V5.0 - Интеграция с YouTube автоматизацией  
// File: modules/HarvesterCore.js

const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');
const MicroworkersScraper = require('./MicroworkersScraper');
const YouTubeAutomator = require('./YouTubeAutomator'); // ✅ НОВЫЙ ИМПОРТ

class HarvesterCore {
    constructor(system) {
        this.system = system;
        this.logger = system.logger.create('HARVESTER');
        this.config = system.config;
        this.security = system.security;
        
        this.version = '5.0.0'; // ✅ ОБНОВЛЕННАЯ ВЕРСИЯ
        this.isRunning = false;
        this.isInitialized = false;
        this.productionMode = false;
        
        // Timing and intervals
        this.scanInterval = this.config.getInt('SCAN_INTERVAL', 180000);
        this.intervalId = null;
        this.startTime = null;
        
        // Task management
        this.taskQueue = [];
        this.activeTasks = new Map();
        this.completedTasks = [];
        this.failedTasks = [];
        
        // ✅ НОВЫЕ МОДУЛИ
        this.microworkersScraper = null;
        this.youtubeAutomator = null; // ✅ YouTube автоматизация
        this.useScrapingFallback = this.config.getBool('USE_SCRAPING_FALLBACK', true);

        // ✅ ОБНОВИТЬ metrics - добавить YouTube метрики
        this.metrics = {
            // Task metrics
            tasksCompleted: 0,
            tasksSuccessful: 0,
            tasksFailed: 0,
            tasksInProgress: 0,
            
            // ✅ YouTube specific metrics
            youtubeTasksCompleted: 0,
            youtubeTasksSuccessful: 0,
            youtubeTasksFailed: 0,
            totalWatchTime: 0, // В секундах
            videosLiked: 0,
            channelsSubscribed: 0,
            
            // Earnings metrics
            totalEarnings: 0,
            pendingEarnings: 0,
            withdrawnEarnings: 0,
            lastPayout: null,
            
            // ✅ YouTube earnings
            youtubeEarnings: 0,
            
            // Performance metrics
            taskCycles: 0,
            apiCalls: 0,
            errors: 0,
            retryAttempts: 0,
            avgTaskDuration: 0,
            avgTaskReward: 0,
            
            // Platform metrics
            realTasksExecuted: 0,
            demoTasksExecuted: 0,
            platformErrors: {},
            
            // Security metrics
            securityChecks: 0,
            suspiciousActivities: 0,
            
            // Scraping metrics
            scrapingAttempts: 0,
            scrapingSuccesses: 0,
            scrapingErrors: 0,
            
            // Time metrics
            lastTaskTime: null,
            lastSuccessTime: null,
            lastErrorTime: null
        };

        this.logger.info('[◉] HarvesterCore V5.0 initialized with YouTube automation');
    }

    // ✅ ОБНОВИТЬ initialize() - добавить YouTube automator инициализацию
    async initialize() {
        try {
            this.logger.info('[▸] Initializing HarvesterCore V5.0 for PRODUCTION...');
            
            // Security validation
            await this.validateSecurityRequirements();
            
            // ✅ Initialize enhanced scraper
            if (this.useScrapingFallback) {
                this.logger.info('[▸] Initializing enhanced web scraper...');
                this.microworkersScraper = new MicroworkersScraper(this.system);
                await this.microworkersScraper.initialize();
                this.logger.success('[✓] Enhanced web scraper initialized');
            }
            
            // ✅ Initialize YouTube automator
            this.logger.info('[▸] Initializing YouTube automator...');
            this.youtubeAutomator = new YouTubeAutomator(this.system);
            await this.youtubeAutomator.initialize();
            this.logger.success('[✓] YouTube automator initialized');
            
            // Initialize platforms
            await this.initializePlatforms();
            
            // Load tasks  
            await this.loadProductionTasks();
            
            this.isInitialized = true;
            this.logger.success('[✓] HarvesterCore V5.0 PRODUCTION ready with YouTube automation');
            
            return { success: true, message: 'HarvesterCore V5.0 initialized with YouTube automation' };
            
        } catch (error) {
            this.logger.error(`[✗] Initialization failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    // ✅ ОБНОВИТЬ start() - добавить лог о YouTube
    async start() {
        if (this.isRunning) {
            return { success: false, message: '[○] HarvesterCore is already running' };
        }

        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return initResult;
            }
        }

        try {
            this.isRunning = true;
            this.startTime = new Date();
            
            this.logger.success('[◉] HarvesterCore V5.0 started with YouTube automation');
            
            await this.logger.logSecurity('harvester_started', {
                mode: 'PRODUCTION_V5',
                startTime: this.startTime.toISOString(),
                enabledPlatforms: Object.values(this.platforms).filter(p => p.enabled).length,
                scrapingEnabled: this.useScrapingFallback,
                youtubeAutomationEnabled: !!this.youtubeAutomator
            });
            
            await this.executeMainLoop();
            
            this.intervalId = setInterval(async () => {
                if (this.isRunning) {
                    await this.executeMainLoop();
                }
            }, this.scanInterval);

            return { 
                success: true, 
                message: '[◉] HarvesterCore V5.0 activated with YouTube automation'
            };
            
        } catch (error) {
            this.logger.error(`[✗] Start failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

// ✅ ДОПИСАТЬ В КОНЕЦ HarvesterCore.js ПОСЛЕ fetchSpare5Tasks()
    
    // ✅ ГЛАВНЫЙ МЕТОД ВЫПОЛНЕНИЯ ЗАДАНИЙ
    async executeTask(task) {
        const taskId = task.id;
        const startTime = Date.now();
        
        this.activeTasks.set(taskId, {
            ...task,
            startTime: new Date(),
            status: 'executing'
        });
        
        this.metrics.tasksInProgress++;
        this.metrics.lastTaskTime = new Date();
        
        this.logger.info(`[▸] EXECUTING REAL TASK: ${task.title} (${task.platform})`);
        
        await this.logger.logTransaction('task_started', {
            taskId: taskId,
            platform: task.platform,
            category: task.category,
            reward: task.reward,
            isProduction: true,
            scraped: task.scraped || false,
            youtubeTask: task.category === 'youtube_task'
        });
        
        try {
            const result = await this.performRealTaskExecution(task);
            
            if (result.success) {
                await this.handleTaskSuccess(task, result, Date.now() - startTime);
            } else {
                await this.handleTaskFailure(task, result.error, Date.now() - startTime);
            }
            
        } catch (error) {
            await this.handleTaskFailure(task, error.message, Date.now() - startTime);
        } finally {
            this.activeTasks.delete(taskId);
            this.metrics.tasksInProgress--;
        }
    }

    // ✅ UPDATED: Выполнение с YouTube автоматизацией
    async performRealTaskExecution(task) {
        this.logger.info(`[◉] REAL PRODUCTION TASK: ${task.id} on ${task.platform}`);
        this.metrics.realTasksExecuted++;
        
        try {
            if (!this.validateTaskSecurity(task)) {
                throw new Error('Task failed final security validation');
            }
            
            let result;
            
            // ✅ ГЛАВНОЕ ИЗМЕНЕНИЕ: YouTube автоматизация
            if (task.category === 'youtube_task' && this.youtubeAutomator) {
                this.logger.info(`[🎥] Executing YouTube task via automation...`);
                result = await this.executeYouTubeTaskAutomation(task);
            } else {
                // Обычные задания
                switch (task.platform) {
                    case 'microworkers':
                        result = await this.executeMicroworkersTask(task);
                        break;
                    case 'clickworker':
                        result = await this.executeClickworkerTask(task);
                        break;
                    case 'spare5':
                        result = await this.executeSpare5Task(task);
                        break;
                    default:
                        throw new Error(`Unsupported platform: ${task.platform}`);
                }
            }
            
            // Submit result back to platform
            if (result.success) {
                const submitResult = await this.submitRealTaskResult(task, result);
                result.submitted = submitResult;
            }
            
            return result;
            
        } catch (error) {
            this.logger.error(`[✗] REAL task execution failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                taskId: task.id,
                platform: task.platform
            };
        }
    }

    // ✅ НОВЫЙ МЕТОД: YouTube автоматизация
    async executeYouTubeTaskAutomation(task) {
        this.logger.info(`[🎥] Starting YouTube automation for: ${task.title}`);
        
        try {
            // Выполнить через YouTubeAutomator
            const automationResult = await this.youtubeAutomator.executeYouTubeTask(task);
            
            if (automationResult.success) {
                // ✅ Обновить метрики YouTube
                this.metrics.youtubeTasksCompleted++;
                this.metrics.youtubeTasksSuccessful++;
                this.metrics.youtubeEarnings += task.reward;
                this.metrics.totalWatchTime += task.watchDuration || 180;
                
                if (task.requiresLike) {
                    this.metrics.videosLiked++;
                }
                
                if (task.requiresSubscribe) {
                    this.metrics.channelsSubscribed++;
                }
                
                this.logger.success(`[🎥] YouTube task automation completed successfully!`);
                this.logger.success(`[💰] Earned: $${task.reward} from YouTube task`);
                this.logger.info(`[📊] Total YouTube earnings: $${this.metrics.youtubeEarnings.toFixed(2)}`);
                
                return {
                    success: true,
                    taskId: task.id,
                    originalId: task.originalId,
                    platform: 'microworkers',
                    category: 'youtube_task',
                    reward: task.reward,
                    completionTime: new Date(),
                    proof: automationResult.proof,
                    videoUrl: automationResult.videoUrl,
                    automationDetails: {
                        watchDuration: task.watchDuration,
                        liked: task.requiresLike,
                        subscribed: task.requiresSubscribe,
                        screenshotsTaken: automationResult.proof?.screenshots?.length || 0
                    },
                    qualityScore: 95 + Math.floor(Math.random() * 5),
                    isProduction: true,
                    automated: true
                };
            } else {
                this.metrics.youtubeTasksFailed++;
                throw new Error(`YouTube automation failed: ${automationResult.error}`);
            }
            
        } catch (error) {
            this.metrics.youtubeTasksFailed++;
            this.logger.error(`[✗] YouTube automation error: ${error.message}`);
            throw error;
        }
    }

    async submitRealTaskResult(task, result) {
        try {
            // ✅ YouTube задания отправляются через YouTubeAutomator
            if (task.category === 'youtube_task' && result.proof) {
                this.logger.info('[▸] Submitting YouTube task proof to Microworkers...');
                return await this.youtubeAutomator.submitProofToMicroworkers(task, result.proof);
            }
            
            switch (task.platform) {
                case 'microworkers':
                    return await this.submitMicroworkersResult(task, result);
                case 'clickworker':
                    return await this.submitClickworkerResult(task, result);
                case 'spare5':
                    return await this.submitSpare5Result(task, result);
                default:
                    return false;
            }
        } catch (error) {
            this.logger.error(`[✗] Task submission failed: ${error.message}`);
            return false;
        }
    }

    async executeMainLoop() {
        this.logger.debug('[▸] Executing main harvester loop with YouTube automation...');
        
        // ✅ Приоритет YouTube заданиям
        let task = this.taskQueue.find(t => t.category === 'youtube_task');
        if (!task) {
            task = this.taskQueue.shift();
        } else {
            // Удалить YouTube задание из очереди
            const index = this.taskQueue.indexOf(task);
            this.taskQueue.splice(index, 1);
        }
        
        if (task) {
            await this.executeTask(task);
        }
        
        // Refresh task queue if needed
        if (this.taskQueue.length < 5) {
            await this.loadProductionTasks();
        }
    }

    async handleTaskSuccess(task, result, duration) {
        this.metrics.tasksSuccessful++;
        this.metrics.totalEarnings += task.reward;
        this.metrics.lastSuccessTime = new Date();
        
        this.completedTasks.push({
            ...task,
            result: result,
            duration: duration,
            completedAt: new Date()
        });
        
        // ✅ Специальное логирование для YouTube
        if (task.category === 'youtube_task') {
            this.logger.success(`[🎥] YouTube task completed: ${task.title} - $${task.reward} (Automated)`);
            this.logger.info(`[📊] Total YouTube earnings: $${this.metrics.youtubeEarnings.toFixed(2)}`);
            this.logger.info(`[⏱️] Total watch time: ${Math.round(this.metrics.totalWatchTime / 60)} minutes`);
        } else {
            this.logger.success(`[✓] Task completed: ${task.title} - $${task.reward}${task.scraped ? ' (Scraped)' : ''}`);
        }
    }

    async handleTaskFailure(task, error, duration) {
        this.metrics.tasksFailed++;
        this.metrics.lastErrorTime = new Date();
        
        this.failedTasks.push({
            ...task,
            error: error,
            duration: duration,
            failedAt: new Date()
        });
        
        if (task.category === 'youtube_task') {
            this.logger.error(`[✗] YouTube task failed: ${task.title} - ${error} (Automation)`);
        } else {
            this.logger.error(`[✗] Task failed: ${task.title} - ${error}${task.scraped ? ' (Scraped)' : ''}`);
        }
    }

    // ✅ ОБНОВЛЕНИЕ: Close с YouTube automator
    async stop() {
        if (!this.isRunning) {
            return { success: false, message: '[○] HarvesterCore is not running' };
        }

        try {
            this.isRunning = false;
            
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            
            // ✅ Close YouTube automator
            if (this.youtubeAutomator) {
                this.logger.info('[▸] Closing YouTube automator...');
                await this.youtubeAutomator.close();
                this.logger.success('[✓] YouTube automator closed');
            }
            
            // ✅ Close enhanced scraper
            if (this.microworkersScraper) {
                this.logger.info('[▸] Closing enhanced scraper...');
                await this.microworkersScraper.close();
                this.logger.success('[✓] Enhanced scraper closed');
            }
            
            this.logger.success('[◯] HarvesterCore V5.0 stopped gracefully');
            return { success: true, message: '[◯] HarvesterCore V5.0 stopped successfully' };
            
        } catch (error) {
            this.logger.error(`[✗] Stop failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    // ✅ YouTube специфичные метрики
    getYouTubeStats() {
        return {
            tasksCompleted: this.metrics.youtubeTasksCompleted,
            tasksSuccessful: this.metrics.youtubeTasksSuccessful,
            tasksFailed: this.metrics.youtubeTasksFailed,
            earnings: this.metrics.youtubeEarnings,
            totalWatchTime: this.metrics.totalWatchTime,
            videosLiked: this.metrics.videosLiked,
            channelsSubscribed: this.metrics.channelsSubscribed,
            successRate: this.metrics.youtubeTasksCompleted > 0 ? 
                `${(this.metrics.youtubeTasksSuccessful / this.metrics.youtubeTasksCompleted * 100).toFixed(1)}%` : '0%'
        };
    }

    // ✅ РАСШИРЕННЫЕ getDetailedMetrics с YouTube
    getDetailedMetrics() {
        return {
            ...this.metrics,
            successRate: this.getSuccessRate(),
            scrapingSuccessRate: this.metrics.scrapingAttempts > 0 ? 
                `${(this.metrics.scrapingSuccesses / this.metrics.scrapingAttempts * 100).toFixed(1)}%` : '0%',
            
            // ✅ YouTube статистика
            youtube: this.getYouTubeStats(),
            
            platforms: Object.fromEntries(
                Object.entries(this.platforms).map(([name, platform]) => [
                    name, 
                    {
                        enabled: platform.enabled,
                        taskCount: platform.taskCount,
                        successRate: platform.successRate
                    }
                ])
            ),
            scraping: {
                enabled: this.useScrapingFallback,
                attempts: this.metrics.scrapingAttempts,
                successes: this.metrics.scrapingSuccesses,
                errors: this.metrics.scrapingErrors,
                successRate: this.metrics.scrapingAttempts > 0 ? 
                    `${(this.metrics.scrapingSuccesses / this.metrics.scrapingAttempts * 100).toFixed(1)}%` : '0%'
            },
            automation: {
                youtubeEnabled: !!this.youtubeAutomator,
                youtubeStats: this.youtubeAutomator ? this.youtubeAutomator.getStats() : null
            }
        };
    }

    // ✅ ОБНОВЛЕНИЕ: calculateTaskPriority с YouTube приоритетом
    calculateTaskPriority(task) {
        let priority = 0;
        
        // ✅ YouTube задания получают высший приоритет
        if (task.category === 'youtube_task') {
            priority += 200; // Очень высокий приоритет
        }
        
        // Reward weight
        priority += task.reward * 100;
        
        // Time weight
        priority += (3600 - Math.min(task.estimatedTime, 3600)) / 10;
        
        // Platform preference
        const platformPriority = {
            microworkers: 3,
            clickworker: 2,
            spare5: 1
        };
        priority += (platformPriority[task.platform] || 0) * 10;
        
        // Category preference (YouTube уже учтен выше)
        const categoryPriority = {
            youtube_task: 10, // Максимальный приоритет
            social_media: 5,
            website_review: 4,
            survey: 3,
            data_entry: 2,
            content_review: 1
        };
        priority += (categoryPriority[task.category] || 0) * 5;
        
        // Deadline urgency
        if (task.deadline) {
            const timeToDeadline = task.deadline.getTime() - Date.now();
            if (timeToDeadline < 24 * 60 * 60 * 1000) {
                priority += 50;
            }
        }
        
        // Bonus for scraped tasks
        if (task.scraped) {
            priority += 25;
        }
        
        return Math.round(priority);
    }
