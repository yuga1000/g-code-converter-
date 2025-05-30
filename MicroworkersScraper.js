// MicroworkersScraper V1.0 - Web Scraping модуль для обхода API ограничений
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
        this.minDelay = 3000; // 3 seconds between requests
        this.maxRetries = 3;
        
        this.logger.info('[◉] MicroworkersScraper initialized');
    }

    async initialize() {
        try {
            this.logger.info('[▸] Initializing browser...');
            
            // Launch puppeteer browser
            this.browser = await puppeteer.launch({
                headless: 'new', // Use new headless mode
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
            
            // Set realistic user agent
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Set viewport
            await this.page.setViewport({ width: 1366, height: 768 });
            
            this.logger.success('[✓] Browser initialized');
            
            return { success: true, message: 'Scraper initialized' };
            
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
            
            // Navigate to login page
            await this.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });
            
            // Wait for login form
            await this.page.waitForSelector('input[name="email"]', { timeout: 10000 });
            
            // Fill login form
            await this.page.type('input[name="email"]', this.email);
            await this.page.type('input[name="password"]', this.password);
            
            // Submit form
            await Promise.all([
                this.page.click('button[type="submit"], input[type="submit"]'),
                this.page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
            
            // Check if login successful
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

    async scrapeJobs() {
        try {
            this.logger.info('[▸] Scraping jobs from Microworkers...');
            
            // Ensure we're logged in
            if (!this.isLoggedIn) {
                await this.login();
            }
            
            // Navigate to jobs page
            await this.page.goto(this.jobsUrl, { waitUntil: 'networkidle2' });
            
            // Wait for jobs to load
            await this.page.waitForSelector('.job-item, .task-item, [data-job-id], .campaign-item', { timeout: 15000 });
            
            // Extract job data
            const jobs = await this.page.evaluate(() => {
                const jobElements = document.querySelectorAll('.job-item, .task-item, [data-job-id], .campaign-item, tr[data-job-id]');
                const extractedJobs = [];
                
                jobElements.forEach((jobEl, index) => {
                    try {
                        // Try different selectors for different page layouts
                        const titleEl = jobEl.querySelector('.job-title, .task-title, .title, h3, h4, .campaign-title') || 
                                       jobEl.querySelector('a[href*="/job/"], a[href*="/task/"]');
                        
                        const priceEl = jobEl.querySelector('.price, .payment, .reward, .amount, .money') ||
                                       jobEl.querySelector('[class*="price"], [class*="payment"], [class*="reward"]');
                        
                        const descEl = jobEl.querySelector('.description, .desc, .brief, .summary');
                        
                        const timeEl = jobEl.querySelector('.time, .duration, .estimate, [class*="time"]');
                        
                        const linkEl = jobEl.querySelector('a[href*="/job/"], a[href*="/task/"]') || titleEl;
                        
                        // Extract data
                        const title = titleEl ? titleEl.textContent.trim() : `Job ${index + 1}`;
                        const priceText = priceEl ? priceEl.textContent.trim() : '$0.00';
                        const description = descEl ? descEl.textContent.trim() : '';
                        const timeText = timeEl ? timeEl.textContent.trim() : '';
                        const link = linkEl ? linkEl.href : '';
                        
                        // Parse price
                        const priceMatch = priceText.match(/\$?(\d+\.?\d*)/);
                        const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
                        
                        // Parse time (try to extract minutes)
                        const timeMatch = timeText.match(/(\d+)\s*(min|minute|hour|hr)/i);
                        let estimatedTime = 300; // Default 5 minutes
                        if (timeMatch) {
                            const timeValue = parseInt(timeMatch[1]);
                            const timeUnit = timeMatch[2].toLowerCase();
                            if (timeUnit.includes('hour') || timeUnit.includes('hr')) {
                                estimatedTime = timeValue * 3600;
                            } else {
                                estimatedTime = timeValue * 60;
                            }
                        }
                        
                        // Extract job ID from link or data attribute
                        let jobId = jobEl.getAttribute('data-job-id') || 
                                   jobEl.getAttribute('data-id') ||
                                   `scraped_${Date.now()}_${index}`;
                        
                        if (link && !jobId.startsWith('scraped_')) {
                            const idMatch = link.match(/\/(?:job|task)\/(\d+)/);
                            if (idMatch) {
                                jobId = idMatch[1];
                            }
                        }
                        
                        if (title && price >= 0) {
                            extractedJobs.push({
                                id: jobId,
                                title: title,
                                description: description,
                                price: price,
                                estimatedTime: estimatedTime,
                                link: link,
                                category: 'general', // Will be categorized later
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
            
            this.logger.success(`[✓] Scraped ${jobs.length} jobs from Microworkers`);
            this.lastScrapeTime = new Date();
            
            // Convert to standard format
            return jobs.map(job => this.normalizeScrapedJob(job));
            
        } catch (error) {
            this.logger.error(`[✗] Scraping failed: ${error.message}`);
            
            // Try to take screenshot for debugging
            try {
                await this.page.screenshot({ path: 'scraping_error.png', fullPage: true });
                this.logger.debug('[◎] Screenshot saved as scraping_error.png');
            } catch (screenshotError) {
                // Ignore screenshot errors
            }
            
            throw error;
        }
    }

    normalizeScrapedJob(scrapedJob) {
        return {
            id: `mw_scraped_${scrapedJob.id}`,
            originalId: scrapedJob.id,
            title: scrapedJob.title,
            description: scrapedJob.description,
            category: this.categorizeJob(scrapedJob.title, scrapedJob.description),
            reward: scrapedJob.price,
            estimatedTime: scrapedJob.estimatedTime,
            instructions: scrapedJob.description,
            requirements: [],
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
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
    }

    categorizeJob(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        
        if (text.includes('youtube') || text.includes('video') || text.includes('watch')) {
            return 'video_tasks';
        } else if (text.includes('social') || text.includes('follow') || text.includes('like') || text.includes('comment')) {
            return 'social_media';
        } else if (text.includes('search') || text.includes('google') || text.includes('bing')) {
            return 'search_tasks';
        } else if (text.includes('signup') || text.includes('register') || text.includes('account')) {
            return 'signup_tasks';
        } else if (text.includes('review') || text.includes('rating') || text.includes('feedback')) {
            return 'review_tasks';
        } else if (text.includes('survey') || text.includes('questionnaire')) {
            return 'survey';
        } else if (text.includes('data') || text.includes('entry') || text.includes('typing')) {
            return 'data_entry';
        } else if (text.includes('website') || text.includes('visit') || text.includes('browse')) {
            return 'website_review';
        } else {
            return 'general';
        }
    }

    async getAvailableJobs() {
        try {
            // Rate limiting
            if (this.lastScrapeTime) {
                const timeSince = Date.now() - this.lastScrapeTime.getTime();
                if (timeSince < this.minDelay) {
                    this.logger.debug(`[◎] Rate limiting: waiting ${this.minDelay - timeSince}ms`);
                    await this.sleep(this.minDelay - timeSince);
                }
            }
            
            const jobs = await this.scrapeJobs();
            
            // Log scraping results
            await this.system.logger.logSecurity('jobs_scraped', {
                source: 'microworkers_scraper',
                jobCount: jobs.length,
                timestamp: new Date().toISOString()
            });
            
            return jobs;
            
        } catch (error) {
            this.logger.error(`[✗] Failed to get jobs: ${error.message}`);
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
                this.logger.info('[◯] Browser closed');
            }
        } catch (error) {
            this.logger.error(`[✗] Error closing browser: ${error.message}`);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Health check
    async isHealthy() {
        try {
            if (!this.browser || !this.page) return false;
            
            // Check if page is still responsive
            await this.page.evaluate(() => document.title);
            return true;
        } catch (error) {
            return false;
        }
    }

    async restart() {
        this.logger.info('[▸] Restarting scraper...');
        await this.close();
        await this.initialize();
        this.isLoggedIn = false;
    }
}

module.exports = MicroworkersScraper;
