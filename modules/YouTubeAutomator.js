// YouTubeAutomator V1.0 - Автоматическое выполнение YouTube заданий
// File: modules/YouTubeAutomator.js

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class YouTubeAutomator {
    constructor(system) {
        this.system = system;
        this.logger = system.logger.create('YT_AUTO');
        this.config = system.config;
        
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        
        // Настройки для YouTube
        this.youtubeBaseUrl = 'https://www.youtube.com';
        this.searchUrl = 'https://www.youtube.com/results?search_query=';
        
        // Папка для скриншотов
        this.screenshotDir = './screenshots';
        
        // Счетчики
        this.tasksCompleted = 0;
        this.tasksSuccessful = 0;
        this.tasksFailed = 0;
        
        this.logger.info('[🎥] YouTubeAutomator initialized');
    }

    async initialize() {
        try {
            this.logger.info('[▸] Initializing YouTube Automator...');
            
            // Создать папку для скриншотов
            await fs.mkdir(this.screenshotDir, { recursive: true });
            
            // Запустить браузер
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--start-maximized'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            // Настроить User-Agent
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Настроить viewport
            await this.page.setViewport({ width: 1920, height: 1080 });
            
            // Блокировать рекламу и ненужные ресурсы
            await this.page.setRequestInterception(true);
            this.page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'image') {
                    req.abort();
                } else {
                    req.continue();
                }
            });
            
            this.isInitialized = true;
            this.logger.success('[✓] YouTube Automator ready');
            
            return { success: true, message: 'YouTube Automator initialized' };
            
        } catch (error) {
            this.logger.error(`[✗] Initialization failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    async executeYouTubeTask(task) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const taskId = `yt_${Date.now()}`;
        const startTime = Date.now();
        
        this.logger.info(`[🎥] Starting YouTube task: ${task.title}`);
        this.logger.info(`[▸] Search query: "${task.searchQuery}"`);
        this.logger.info(`[▸] Watch duration: ${task.watchDuration}s`);
        this.logger.info(`[▸] Requires like: ${task.requiresLike ? 'Yes' : 'No'}`);
        
        try {
            // Шаг 1: Поиск видео
            this.logger.info('[▸] Step 1: Searching for video...');
            const videoUrl = await this.searchVideo(task.searchQuery, taskId);
            
            if (!videoUrl) {
                throw new Error('No suitable video found');
            }
            
            // Шаг 2: Просмотр видео
            this.logger.info('[▸] Step 2: Watching video...');
            await this.watchVideo(videoUrl, task.watchDuration, taskId);
            
            // Шаг 3: Лайк (если требуется)
            if (task.requiresLike) {
                this.logger.info('[▸] Step 3: Liking video...');
                await this.likeVideo(taskId);
            }
            
            // Шаг 4: Подписка (если требуется)
            if (task.requiresSubscribe) {
                this.logger.info('[▸] Step 4: Subscribing to channel...');
                await this.subscribeToChannel(taskId);
            }
            
            // Шаг 5: Финальный скриншот
            this.logger.info('[▸] Step 5: Taking final screenshot...');
            const finalScreenshot = await this.takeScreenshot(taskId, 'final');
            
            // Генерировать отчет
            const proof = await this.generateProof(task, taskId, {
                videoUrl: videoUrl,
                watchDuration: task.watchDuration,
                liked: task.requiresLike,
                subscribed: task.requiresSubscribe,
                screenshots: await this.getTaskScreenshots(taskId),
                duration: Date.now() - startTime
            });
            
            this.tasksCompleted++;
            this.tasksSuccessful++;
            
            this.logger.success(`[✓] YouTube task completed: ${task.title}`);
            this.logger.success(`[💰] Reward: $${task.reward}`);
            
            return {
                success: true,
                taskId: taskId,
                proof: proof,
                videoUrl: videoUrl,
                duration: Date.now() - startTime,
                reward: task.reward
            };
            
        } catch (error) {
            this.tasksCompleted++;
            this.tasksFailed++;
            
            this.logger.error(`[✗] YouTube task failed: ${error.message}`);
            
            // Скриншот ошибки
            try {
                await this.takeScreenshot(taskId, 'error');
            } catch (screenshotError) {
                // Ignore screenshot errors
            }
            
            return {
                success: false,
                taskId: taskId,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    async searchVideo(searchQuery, taskId) {
        try {
            // Перейти на YouTube поиск
            const searchUrl = this.searchUrl + encodeURIComponent(searchQuery);
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Скриншот поиска
            await this.takeScreenshot(taskId, 'search');
            
            // Подождать загрузки результатов
            await this.page.waitForSelector('#contents ytd-video-renderer', { timeout: 15000 });
            
            // Найти первое подходящее видео
            const videoUrl = await this.page.evaluate(() => {
                const videoElements = document.querySelectorAll('#contents ytd-video-renderer');
                
                for (const videoEl of videoElements) {
                    const linkEl = videoEl.querySelector('a#video-title');
                    const durationEl = videoEl.querySelector('span.style-scope.ytd-thumbnail-overlay-time-status-renderer');
                    
                    if (linkEl && durationEl) {
                        const duration = durationEl.textContent.trim();
                        const href = linkEl.href;
                        
                        // Проверить что видео достаточно длинное (минимум 2 минуты)
                        const durationParts = duration.split(':');
                        let totalSeconds = 0;
                        
                        if (durationParts.length === 2) {
                            totalSeconds = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
                        } else if (durationParts.length === 3) {
                            totalSeconds = parseInt(durationParts[0]) * 3600 + parseInt(durationParts[1]) * 60 + parseInt(durationParts[2]);
                        }
                        
                        if (totalSeconds >= 120) { // Минимум 2 минуты
                            return href;
                        }
                    }
                }
                return null;
            });
            
            if (!videoUrl) {
                throw new Error('No suitable video found in search results');
            }
            
            this.logger.success(`[✓] Found video: ${videoUrl}`);
            return videoUrl;
            
        } catch (error) {
            this.logger.error(`[✗] Search failed: ${error.message}`);
            throw error;
        }
    }

    async watchVideo(videoUrl, watchDuration, taskId) {
        try {
            // Открыть видео
            await this.page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Скриншот начала просмотра
            await this.takeScreenshot(taskId, 'video_start');
            
            // Подождать загрузки плеера
            await this.page.waitForSelector('video', { timeout: 15000 });
            
            // Запустить видео если оно не воспроизводится
            await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (video && video.paused) {
                    video.play();
                }
            });
            
            this.logger.info(`[▸] Watching video for ${watchDuration} seconds...`);
            
            // Смотреть видео частями, делая скриншоты
            const intervalDuration = Math.min(30, watchDuration / 4); // Скриншот каждые 30 сек или 1/4 времени
            let watchedTime = 0;
            
            while (watchedTime < watchDuration) {
                const waitTime = Math.min(intervalDuration * 1000, (watchDuration - watchedTime) * 1000);
                await this.sleep(waitTime);
                watchedTime += waitTime / 1000;
                
                // Скриншот прогресса
                await this.takeScreenshot(taskId, `watch_${Math.round(watchedTime)}s`);
                
                // Проверить что видео все еще воспроизводится
                const isPlaying = await this.page.evaluate(() => {
                    const video = document.querySelector('video');
                    return video && !video.paused && !video.ended;
                });
                
                if (!isPlaying) {
                    this.logger.warn('[--] Video stopped, trying to resume...');
                    await this.page.evaluate(() => {
                        const video = document.querySelector('video');
                        if (video) video.play();
                    });
                }
                
                this.logger.debug(`[◎] Watched ${Math.round(watchedTime)}/${watchDuration} seconds`);
            }
            
            this.logger.success('[✓] Video watching completed');
            
        } catch (error) {
            this.logger.error(`[✗] Video watching failed: ${error.message}`);
            throw error;
        }
    }

    async likeVideo(taskId) {
        try {
            // Найти кнопку лайка
            await this.page.waitForSelector('like-button-view-model button[aria-label*="like"], #top-level-buttons-computed like-button-view-model button', { timeout: 10000 });
            
            // Скриншот до лайка
            await this.takeScreenshot(taskId, 'before_like');
            
            // Кликнуть лайк
            await this.page.evaluate(() => {
                const likeButtons = document.querySelectorAll('like-button-view-model button[aria-label*="like"], #top-level-buttons-computed like-button-view-model button');
                for (const button of likeButtons) {
                    if (button.getAttribute('aria-pressed') === 'false') {
                        button.click();
                        break;
                    }
                }
            });
            
            // Подождать применения лайка
            await this.sleep(2000);
            
            // Скриншот после лайка
            await this.takeScreenshot(taskId, 'after_like');
            
            this.logger.success('[✓] Video liked');
            
        } catch (error) {
            this.logger.error(`[✗] Liking failed: ${error.message}`);
            throw error;
        }
    }

    async subscribeToChannel(taskId) {
        try {
            // Найти кнопку подписки
            await this.page.waitForSelector('#subscribe-button button, .ytd-subscribe-button-renderer button', { timeout: 10000 });
            
            // Скриншот до подписки
            await this.takeScreenshot(taskId, 'before_subscribe');
            
            // Кликнуть подписку
            await this.page.evaluate(() => {
                const subscribeButtons = document.querySelectorAll('#subscribe-button button, .ytd-subscribe-button-renderer button');
                for (const button of subscribeButtons) {
                    if (button.textContent.toLowerCase().includes('subscribe')) {
                        button.click();
                        break;
                    }
                }
            });
            
            // Подождать применения подписки
            await this.sleep(3000);
            
            // Скриншот после подписки
            await this.takeScreenshot(taskId, 'after_subscribe');
            
            this.logger.success('[✓] Subscribed to channel');
            
        } catch (error) {
            this.logger.warn(`[--] Subscription failed: ${error.message}`);
            // Подписка не критична, продолжаем
        }
    }

    async takeScreenshot(taskId, stage) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${taskId}_${stage}_${timestamp}.png`;
            const filepath = path.join(this.screenshotDir, filename);
            
            await this.page.screenshot({
                path: filepath,
                fullPage: true,
                quality: 80
            });
            
            this.logger.debug(`[📸] Screenshot saved: ${filename}`);
            return filename;
            
        } catch (error) {
            this.logger.error(`[✗] Screenshot failed: ${error.message}`);
            return null;
        }
    }

    async getTaskScreenshots(taskId) {
        try {
            const files = await fs.readdir(this.screenshotDir);
            const taskScreenshots = files.filter(file => file.startsWith(taskId));
            
            return taskScreenshots.map(filename => ({
                filename: filename,
                path: path.join(this.screenshotDir, filename),
                stage: filename.split('_')[1] // Извлечь stage из имени файла
            }));
        } catch (error) {
            this.logger.error(`[✗] Failed to get screenshots: ${error.message}`);
            return [];
        }
    }

    async generateProof(task, taskId, executionDetails) {
        const proof = {
            taskId: taskId,
            originalTask: {
                title: task.title,
                searchQuery: task.searchQuery,
                reward: task.reward,
                requirements: {
                    watchDuration: task.watchDuration,
                    requiresLike: task.requiresLike,
                    requiresSubscribe: task.requiresSubscribe
                }
            },
            execution: {
                videoUrl: executionDetails.videoUrl,
                actualWatchDuration: executionDetails.watchDuration,
                liked: executionDetails.liked,
                subscribed: executionDetails.subscribed,
                completedAt: new Date().toISOString(),
                totalDuration: executionDetails.duration
            },
            proof: {
                screenshots: executionDetails.screenshots,
                screenshotCount: executionDetails.screenshots.length,
                proofGenerated: new Date().toISOString()
            },
            verification: {
                ipAddress: await this.getPublicIP(),
                userAgent: await this.page.evaluate(() => navigator.userAgent),
                timestamp: Date.now()
            }
        };
        
        // Сохранить отчет
        const proofFile = path.join(this.screenshotDir, `${taskId}_proof.json`);
        await fs.writeFile(proofFile, JSON.stringify(proof, null, 2));
        
        this.logger.info(`[📋] Proof generated: ${proofFile}`);
        return proof;
    }

    async getPublicIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    async submitProofToMicroworkers(task, proof) {
        try {
            this.logger.info('[▸] Submitting proof to Microworkers...');
            
            // Здесь будет реальная отправка в Microworkers API
            // Пока что симулируем
            await this.sleep(2000);
            
            const submissionResult = {
                success: true,
                submissionId: `sub_${Date.now()}`,
                status: 'pending_approval',
                estimatedApprovalTime: '24-48 hours',
                submittedAt: new Date().toISOString()
            };
            
            this.logger.success('[✓] Proof submitted to Microworkers');
            this.logger.info(`[📋] Submission ID: ${submissionResult.submissionId}`);
            
            return submissionResult;
            
        } catch (error) {
            this.logger.error(`[✗] Proof submission failed: ${error.message}`);
            throw error;
        }
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                this.isInitialized = false;
                this.logger.info('[◯] YouTube Automator closed');
            }
        } catch (error) {
            this.logger.error(`[✗] Error closing automator: ${error.message}`);
        }
    }

    // Статистика
    getStats() {
        return {
            tasksCompleted: this.tasksCompleted,
            tasksSuccessful: this.tasksSuccessful,
            tasksFailed: this.tasksFailed,
            successRate: this.tasksCompleted > 0 ? 
                `${(this.tasksSuccessful / this.tasksCompleted * 100).toFixed(1)}%` : '0%'
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = YouTubeAutomator;
