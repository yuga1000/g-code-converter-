// Enhanced MicroworkersScraper V2.0 - Детальный парсинг YouTube заданий
// File: modules/MicroworkersScraper.js

const puppeteer = require('puppeteer');

class MicroworkersScraper {
    constructor(system) {
        this.system = system;
        this.logger = system.logger.create('MW_SCRAPER');
        this.config = system.config;
        
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.lastScrapeTime = null;
        
        // Credentials
        this.email = this.config.get('MICROWORKERS_EMAIL');
        this.password = this.config.get('MICROWORKERS_PASSWORD');
        
        // Scraping config
        this.baseUrl = 'https://microworkers.com';
        this.loginUrl = 'https://microworkers.com/login';
        this.jobsUrl = 'https://microworkers.com/jobs';
        
        // Rate limiting
        this.minDelay = 3000;
        this.maxRetries = 3;
        
        this.logger.info('[◉] Enhanced MicroworkersScraper initialized');
    }

    async initialize() {
        try {
            this.logger.info('[▸] Initializing enhanced browser...');
            
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await this.page.setViewport({ width: 1366, height: 768 });
            
            this.logger.success('[✓] Enhanced browser initialized');
            return { success: true, message: 'Enhanced scraper initialized' };
            
        } catch (error) {
            this.logger.error(`[✗] Initialization failed: ${error.message}`);
            return { success: false, message: error.message };
        }
    }

    async login() {
        if (!this.email || !this.password) {
            throw new Error('MICROWORKERS_EMAIL and MICROWORKERS_PASSWORD must be configured');
        }

        try {
            this.logger.info('[▸] Logging into Microworkers...');
            
            await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });
            await this.page.waitForSelector('input[name="email"]', { timeout: 10000 });
            
            await this.page.type('input[name="email"]', this.email);
            await this.page.type('input[name="password"]', this.password);
            
            await Promise.all([
                this.page.click('button[type="submit"], input[type="submit"]'),
                this.page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
            
            const currentUrl = this.page.url();
            if (currentUrl.includes('dashboard') || currentUrl.includes('jobs') || !currentUrl.includes('login')) {
                this.isLoggedIn = true;
                this.logger.success('[✓] Successfully logged into Microworkers');
                return true;
            } else {
                throw new Error('Login failed - redirected back to login page');
            }
            
        } catch (error) {
            this.logger.error(`[✗] Login failed: ${error.message}`);
            throw error;
        }
    }

    async scrapeDetailedJobs() {
        try {
            this.logger.info('[▸] Scraping detailed jobs from Microworkers...');
            
            if (!this.isLoggedIn) {
                await this.login();
            }
            
            await this.page.goto(this.jobsUrl, { waitUntil: 'networkidle2' });
            await this.page.waitForSelector('.job-item, .task-item, [data-job-id], .campaign-item', { timeout: 15000 });
            
            // Извлечение ДЕТАЛЬНЫХ данных о заданиях
            const detailedJobs = await this.page.evaluate(() => {
                const jobElements = document.querySelectorAll('.job-item, .task-item, [data-job-id], .campaign-item, tr[data-job-id]');
                const extractedJobs = [];
                
                jobElements.forEach((jobEl, index) => {
                    try {
                        // Базовые элементы
                        const titleEl = jobEl.querySelector('.job-title, .task-title, .title, h3, h4, .campaign-title') || 
                                       jobEl.querySelector('a[href*="/job/"], a[href*="/task/"]');
                        
                        const priceEl = jobEl.querySelector('.price, .payment, .reward, .amount, .money') ||
                                       jobEl.querySelector('[class*="price"], [class*="payment"], [class*="reward"]');
                        
                        const descEl = jobEl.querySelector('.description, .desc, .brief, .summary');
                        const timeEl = jobEl.querySelector('.time, .duration, .estimate, [class*="time"]');
                        const linkEl = jobEl.querySelector('a[href*="/job/"], a[href*="/task/"]') || titleEl;
                        
                        // Извлечение базовых данных
                        const title = titleEl ? titleEl.textContent.trim() : `Job ${index + 1}`;
                        const priceText = priceEl ? priceEl.textContent.trim() : '$0.00';
                        const description = descEl ? descEl.textContent.trim() : '';
                        const timeText = timeEl ? timeEl.textContent.trim() : '';
                        const link = linkEl ? linkEl.href : '';
                        
                        // Парсинг цены
                        const priceMatch = priceText.match(/\$?(\d+\.?\d*)/);
                        const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
                        
                        // Парсинг времени
                        const timeMatch = timeText.match(/(\d+)\s*(min|minute|hour|hr)/i);
                        let estimatedTime = 300;
                        if (timeMatch) {
                            const timeValue = parseInt(timeMatch[1]);
                            const timeUnit = timeMatch[2].toLowerCase();
                            if (timeUnit.includes('hour') || timeUnit.includes('hr')) {
                                estimatedTime = timeValue * 3600;
                            } else {
                                estimatedTime = timeValue * 60;
                            }
                        }
                        
                        // ID задания
                        let jobId = jobEl.getAttribute('data-job-id') || 
                                   jobEl.getAttribute('data-id') ||
                                   `scraped_${Date.now()}_${index}`;
                        
                        if (link && !jobId.startsWith('scraped_')) {
                            const idMatch = link.match(/\/(?:job|task)\/(\d+)/);
                            if (idMatch) {
                                jobId = idMatch[1];
                            }
                        }
                        
                        // ✅ НОВОЕ: Детальный анализ YouTube заданий
                        const combinedText = (title + ' ' + description).toLowerCase();
                        
                        if (title && price >= 0 && combinedText.includes('youtube')) {
                            const youtubeDetails = this.analyzeYouTubeTask(title, description, combinedText);
                            
                            extractedJobs.push({
                                id: jobId,
                                title: title,
                                description: description,
                                price: price,
                                estimatedTime: estimatedTime,
                                link: link,
                                category: 'youtube_task',
                                scraped: true,
                                scrapedAt: new Date().toISOString(),
                                
                                // ✅ ДЕТАЛЬНЫЕ ДАННЫЕ ДЛЯ YOUTUBE
                                youtubeDetails: youtubeDetails
                            });
                        } else if (title && price >= 0) {
                            // Обычные задания
                            extractedJobs.push({
                                id: jobId,
                                title: title,
                                description: description,
                                price: price,
                                estimatedTime: estimatedTime,
                                link: link,
                                category: 'general',
                                scraped: true,
                                scrapedAt: new Date().toISOString()
                            });
                        }
                    } catch (err) {
                        console.log('Error extracting job:', err);
                    }
                });
                
                return extractedJobs;
            });
            
            this.logger.success(`[✓] Scraped ${detailedJobs.length} detailed jobs`);
            this.lastScrapeTime = new Date();
            
            // Конвертация в стандартный формат с улучшениями
            return detailedJobs.map(job => this.normalizeDetailedJob(job));
            
        } catch (error) {
            this.logger.error(`[✗] Detailed scraping failed: ${error.message}`);
            throw error;
        }
    }

    // ✅ НОВЫЙ МЕТОД: Анализ YouTube заданий
    analyzeYouTubeTask(title, description, combinedText) {
        const details = {
            searchQuery: '',
            watchDuration: 180, // По умолчанию 3 минуты
            requiresLike: false,
            requiresSubscribe: false,
            requiresComment: false,
            screenshotRequired: true,
            specificVideo: null
        };
        
        // Извлечение поискового запроса
        const searchPatterns = [
            /search[:\s]+["']([^"']+)["']/i,
            /search[:\s]+([^\s]+(?:\s+[^\s]+)*?)(?:\s+\+|\s+and|\s*$)/i,
            /"([^"]+)"/,
            /'([^']+)'/
        ];
        
        for (const pattern of searchPatterns) {
            const match = combinedText.match(pattern);
            if (match && match[1]) {
                details.searchQuery = match[1].trim();
                break;
            }
        }
        
        // Если не нашли в кавычках, попробуем другие варианты
        if (!details.searchQuery) {
            // Поиск после "search for", "search:", "find"
            const altPatterns = [
                /(?:search for|find|look for)[:\s]+([^+\n]*?)(?:\s*\+|$)/i,
                /(?:video|channel)[:\s]+([^+\n]*?)(?:\s*\+|$)/i
            ];
            
            for (const pattern of altPatterns) {
                const match = combinedText.match(pattern);
                if (match && match[1]) {
                    details.searchQuery = match[1].trim();
                    break;
                }
            }
        }
        
        // Извлечение времени просмотра
        const durationPatterns = [
            /(\d+)\s*minutes?/i,
            /(\d+)\s*mins?/i,
            /(\d+)\s*seconds?/i,
            /(\d+)\s*secs?/i,
            /watch.*?(\d+)/i
        ];
        
        for (const pattern of durationPatterns) {
            const match = combinedText.match(pattern);
            if (match && match[1]) {
                const duration = parseInt(match[1]);
                if (combinedText.includes('minute') || combinedText.includes('min')) {
                    details.watchDuration = duration * 60;
                } else if (combinedText.includes('second') || combinedText.includes('sec')) {
                    details.watchDuration = duration;
                } else {
                    // По умолчанию считаем минуты
                    details.watchDuration = duration * 60;
                }
                break;
            }
        }
        
        // Проверка требований к действиям
        if (combinedText.includes('like') || combinedText.includes('thumb up')) {
            details.requiresLike = true;
        }
        
        if (combinedText.includes('subscribe') || combinedText.includes('sub to')) {
            details.requiresSubscribe = true;
        }
        
        if (combinedText.includes('comment') || combinedText.includes('write')) {
            details.requiresComment = true;
        }
        
        if (combinedText.includes('screenshot') || combinedText.includes('screen shot') || combinedText.includes('proof')) {
            details.screenshotRequired = true;
        }
        
        return details;
    }

    normalizeDetailedJob(scrapedJob) {
        const normalized = {
            id: `mw_scraped_${scrapedJob.id}`,
            originalId: scrapedJob.id,
            title: scrapedJob.title,
            description: scrapedJob.description,
            category: scrapedJob.category,
            reward: scrapedJob.price,
            estimatedTime: scrapedJob.estimatedTime,
            instructions: scrapedJob.description,
            requirements: [],
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
            maxWorkers: 1,
            availableSlots: 1,
            createdAt: new Date(),
            attempts: 0,
            maxAttempts: 3,
            link: scrapedJob.link,
            scraped: true,
            scrapedAt: scrapedJob.scrapedAt,
            originalData: scrapedJob
        };
        
        // ✅ Добавляем детали YouTube заданий
        if (scrapedJob.youtubeDetails) {
            normalized.youtubeDetails = scrapedJob.youtubeDetails;
            normalized.searchQuery = scrapedJob.youtubeDetails.searchQuery;
            normalized.watchDuration = scrapedJob.youtubeDetails.watchDuration;
            normalized.requiresLike = scrapedJob.youtubeDetails.requiresLike;
            normalized.requiresSubscribe = scrapedJob.youtubeDetails.requiresSubscribe;
            normalized.requiresComment = scrapedJob.youtubeDetails.requiresComment;
            normalized.screenshotRequired = scrapedJob.youtubeDetails.screenshotRequired;
        }
        
        return normalized;
    }

    async getAvailableJobs() {
        try {
            if (this.lastScrapeTime) {
                const timeSince = Date.now() - this.lastScrapeTime.getTime();
                if (timeSince < this.minDelay) {
                    this.logger.debug(`[◎] Rate limiting: waiting ${this.minDelay - timeSince}ms`);
                    await this.sleep(this.minDelay - timeSince);
                }
            }
            
            // ✅ Используем новый детальный метод
            const jobs = await this.scrapeDetailedJobs();
            
            // Фильтруем и логируем YouTube задания
            const youtubeJobs = jobs.filter(job => job.category === 'youtube_task');
            
            if (youtubeJobs.length > 0) {
                this.logger.success(`[🎥] Found ${youtubeJobs.length} YouTube tasks:`);
                youtubeJobs.forEach(job => {
                    this.logger.info(`[▸] "${job.title}" - $${job.reward} - Query: "${job.searchQuery}" - ${job.watchDuration}s`);
                });
            }
            
            await this.system.logger.logSecurity('detailed_jobs_scraped', {
                source: 'enhanced_microworkers_scraper',
                totalJobs: jobs.length,
                youtubeJobs: youtubeJobs.length,
                timestamp: new Date().toISOString()
            });
            
            return jobs;
            
        } catch (error) {
            this.logger.error(`[✗] Failed to get detailed jobs: ${error.message}`);
            return [];
        }
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                this.isLoggedIn = false;
                this.logger.info('[◯] Enhanced browser closed');
            }
        } catch (error) {
            this.logger.error(`[✗] Error closing enhanced browser: ${error.message}`);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async isHealthy() {
        try {
            if (!this.browser || !this.page) return false;
            await this.page.evaluate(() => document.title);
            return true;
        } catch (error) {
            return false;
        }
    }

    async restart() {
        this.logger.info('[▸] Restarting enhanced scraper...');
        await this.close();
        await this.initialize();
        this.isLoggedIn = false;
    }
}

module.exports = MicroworkersScraper;
