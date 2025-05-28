require('dotenv').config();
const https = require('https');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;

class GhostlineHunter {
    constructor() {
        this.codename = 'Ranger';
        this.name = 'GhostlineHunter';
        this.version = '1.0.0';
        this.isRunning = false;
        this.scanInterval = 300000; // 5 minutes between scan cycles
        this.discoveredAssets = [];
        this.processedSources = new Set();
        
        // API Configuration
        this.alchemyApiKey = process.env.ALCHEMY_API_KEY;
        this.etherscanApiKey = process.env.ETHERSCAN_API_KEY;
        this.telegramToken = process.env.TELEGRAM_TOKEN;
        this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
        
        // Scanning Configuration
        this.balanceThreshold = 0.005; // ETH threshold for alerts
        this.maxSourcesPerCycle = 10; // Limit sources per scan cycle
        this.maxPatternMatches = 50; // Limit pattern matches per source
        
        // Pattern Recognition
        this.patterns = this.initializePatterns();
        this.bip39Words = this.loadBip39Wordlist();
        
        // Rate Limiting
        this.lastApiCall = 0;
        this.apiCallDelay = 1000; // 1 second between API calls
        
        // Telegram Bot
        if (this.telegramToken) {
            this.bot = new TelegramBot(this.telegramToken);
        }
        
        this.log('GhostlineHunter (Ranger) initialized and ready for deployment');
        this.validateConfiguration();
    }

    log(message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [RANGER] ${message}`);
    }

    validateConfiguration() {
        const requiredEnvVars = ['ALCHEMY_API_KEY', 'ETHERSCAN_API_KEY', 'TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID'];
        const missing = requiredEnvVars.filter(env => !process.env[env]);
        
        if (missing.length > 0) {
            this.log(`Configuration warning: Missing environment variables: ${missing.join(', ')}`);
        } else {
            this.log('Configuration validated successfully');
        }
    }

    initializePatterns() {
        return {
            privateKey: {
                regex: /(?:^|[^a-fA-F0-9])([a-fA-F0-9]{64})(?:[^a-fA-F0-9]|$)/g,
                confidence: this.validatePrivateKey.bind(this),
                description: 'Ethereum Private Key'
            },
            ethAddress: {
                regex: /(?:^|[^a-fA-F0-9])(0x[a-fA-F0-9]{40})(?:[^a-fA-F0-9]|$)/g,
                confidence: this.validateEthAddress.bind(this),
                description: 'Ethereum Address'
            },
            seedPhrase: {
                regex: null, // Custom validation required
                confidence: this.validateSeedPhrase.bind(this),
                description: 'BIP39 Seed Phrase'
            }
        };
    }

    loadBip39Wordlist() {
        // Standard BIP39 English wordlist (abbreviated for space)
        return new Set([
            'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
            'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
            'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
            'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'against', 'age',
            'agent', 'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol',
            'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also',
            'alter', 'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient',
            'anger', 'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna',
            'antique', 'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch',
            'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange',
            'arrest', 'arrive', 'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault',
            'asset', 'assist', 'assume', 'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract',
            'auction', 'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid',
            'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon',
            'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner', 'bar', 'barely',
            'bargain', 'barrel', 'base', 'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because',
            'become', 'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench',
            'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind',
            'biology', 'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak',
            'bless', 'blind', 'blood', 'blossom', 'blow', 'blue', 'blur', 'blush', 'board', 'boat',
            'body', 'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow',
            'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave',
            'bread', 'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk', 'broccoli', 'broken',
            'bronze', 'broom', 'brother', 'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build',
            'bulb', 'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business',
            'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake',
            'call', 'calm', 'camera', 'camp', 'can', 'canal', 'cancel', 'candy', 'cannon', 'canoe',
            'canvas', 'canyon', 'capable', 'capital', 'captain', 'car', 'carbon', 'card', 'care', 'career',
            'careful', 'careless', 'cargo', 'carpet', 'carry', 'cart', 'case', 'cash', 'casino', 'cast',
            'casual', 'cat', 'catalog', 'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave',
            'ceiling', 'celery', 'cement', 'census', 'century', 'cereal', 'certain', 'chair', 'chalk', 'champion',
            'change', 'chaos', 'chapter', 'charge', 'chase', 'chat', 'cheap', 'check', 'cheese', 'chef',
            'cherry', 'chest', 'chicken', 'chief', 'child', 'chimney', 'choice', 'choose', 'chronic', 'chuckle',
            'chunk', 'churn', 'cigar', 'cinnamon', 'circle', 'citizen', 'city', 'civil', 'claim', 'clamp',
            'clarify', 'clash', 'class', 'clause', 'clean', 'clerk', 'clever', 'click', 'client', 'cliff',
            'climb', 'clinic', 'clip', 'clock', 'clog', 'close', 'cloth', 'cloud', 'clown', 'club',
            'clump', 'cluster', 'clutch', 'coach', 'coast', 'coconut', 'code', 'coffee', 'coil', 'coin',
            'collect', 'color', 'column', 'combine', 'come', 'comfort', 'comic', 'common', 'company', 'concert',
            'conduct', 'confirm', 'congress', 'connect', 'consider', 'control', 'convince', 'cook', 'cool', 'copper',
            'copy', 'coral', 'core', 'corn', 'correct', 'cost', 'cotton', 'couch', 'country', 'couple',
            'course', 'cousin', 'cover', 'coyote', 'crack', 'cradle', 'craft', 'cram', 'crane', 'crash',
            'crater', 'crawl', 'crazy', 'cream', 'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp',
            'critic', 'crop', 'cross', 'crouch', 'crowd', 'crucial', 'cruel', 'cruise', 'crumble', 'crunch',
            'crush', 'cry', 'crystal', 'cube', 'culture', 'cup', 'cupboard', 'curious', 'current', 'curtain',
            'curve', 'cushion', 'custom', 'cute', 'cycle', 'dad', 'damage', 'damp', 'dance', 'danger',
            'daring', 'dash', 'daughter', 'dawn', 'day', 'deal', 'debate', 'debris', 'decade', 'december',
            'decide', 'decline', 'decorate', 'decrease', 'deer', 'defense', 'define', 'defy', 'degree', 'delay',
            'deliver', 'demand', 'demise', 'denial', 'dentist', 'deny', 'depart', 'depend', 'deposit', 'depth',
            'deputy', 'derive', 'describe', 'desert', 'design', 'desk', 'despair', 'destroy', 'detail', 'detect',
            'develop', 'device', 'devote', 'diagram', 'dial', 'diamond', 'diary', 'dice', 'diesel', 'diet',
            'differ', 'digital', 'dignity', 'dilemma', 'dinner', 'dinosaur', 'direct', 'dirt', 'disagree', 'discover',
            'disease', 'dish', 'dismiss', 'disorder', 'display', 'distance', 'divert', 'divide', 'divorce', 'dizzy',
            'doctor', 'document', 'dog', 'doll', 'dolphin', 'domain', 'donate', 'donkey', 'donor', 'door',
            'dose', 'double', 'dove', 'draft', 'dragon', 'drama', 'drape', 'draw', 'dream', 'dress',
            'drift', 'drill', 'drink', 'drip', 'drive', 'drop', 'drum', 'dry', 'duck', 'dumb',
            'dune', 'during', 'dust', 'dutch', 'duty', 'dwarf', 'dynamic', 'eager', 'eagle', 'early',
            'earn', 'earth', 'easily', 'east', 'easy', 'echo', 'ecology', 'economy', 'edge', 'edit',
            'educate', 'effort', 'egg', 'eight', 'either', 'elbow', 'elder', 'electric', 'elegant', 'element',
            'elephant', 'elevator', 'elite', 'else', 'embark', 'embody', 'embrace', 'emerge', 'emotion', 'employ',
            'empower', 'empty', 'enable', 'enact', 'end', 'endless', 'endorse', 'enemy', 'energy', 'enforce',
            'engage', 'engine', 'enhance', 'enjoy', 'enlist', 'enough', 'enrich', 'enroll', 'ensure', 'enter',
            'entire', 'entry', 'envelope', 'episode', 'equal', 'equip', 'era', 'erase', 'erode', 'erosion',
            'error', 'erupt', 'escape', 'essay', 'essence', 'estate', 'eternal', 'ethics', 'evidence', 'evil',
            'evoke', 'evolve', 'exact', 'example', 'excess', 'exchange', 'excite', 'exclude', 'excuse', 'execute',
            'exercise', 'exhaust', 'exhibit', 'exile', 'exist', 'exit', 'exotic', 'expand', 'expect', 'expire',
            'explain', 'expose', 'express', 'extend', 'extra', 'eye', 'eyebrow', 'fabric', 'face', 'faculty',
            'fade', 'faint', 'faith', 'fall', 'false', 'fame', 'family', 'famous', 'fan', 'fancy',
            'fantasy', 'farm', 'fashion', 'fat', 'fatal', 'father', 'fatigue', 'fault', 'favorite', 'feature',
            'february', 'federal', 'fee', 'feed', 'feel', 'female', 'fence', 'festival', 'fetch', 'fever',
            'few', 'fiber', 'fiction', 'field', 'figure', 'file', 'fill', 'film', 'filter', 'final',
            'find', 'fine', 'finger', 'finish', 'fire', 'firm', 'first', 'fiscal', 'fish', 'fit',
            'fitness', 'fix', 'flag', 'flame', 'flash', 'flat', 'flavor', 'flee', 'flight', 'flip',
            'float', 'flock', 'floor', 'flower', 'fluid', 'flush', 'fly', 'foam', 'focus', 'fog',
            'foil', 'fold', 'follow', 'food', 'foot', 'force', 'forest', 'forget', 'fork', 'fortune',
            'forum', 'forward', 'fossil', 'foster', 'found', 'fox', 'frame', 'frequent', 'fresh', 'friend',
            'fringe', 'frog', 'front', 'frost', 'frown', 'frozen', 'fruit', 'fuel', 'fun', 'funny',
            'furnace', 'fury', 'future', 'gadget', 'gain', 'galaxy', 'gallery', 'game', 'gap', 'garage',
            'garbage', 'garden', 'garlic', 'garment', 'gas', 'gasp', 'gate', 'gather', 'gauge', 'gaze',
            'general', 'genius', 'genre', 'gentle', 'genuine', 'gesture', 'ghost', 'giant', 'gift', 'giggle',
            'ginger', 'giraffe', 'girl', 'give', 'glad', 'glance', 'glare', 'glass', 'glide', 'glimpse',
            'globe', 'gloom', 'glory', 'glove', 'glow', 'glue', 'goat', 'goddess', 'gold', 'good',
            'goose', 'gorilla', 'gospel', 'gossip', 'govern', 'gown', 'grab', 'grace', 'grain', 'grant',
            'grape', 'grass', 'gravity', 'great', 'green', 'grid', 'grief', 'grit', 'grocery', 'group',
            'grow', 'grunt', 'guard', 'guess', 'guide', 'guilt', 'guitar', 'gun', 'gym', 'habit',
            'hair', 'half', 'hammer', 'hamster', 'hand', 'happy', 'harbor', 'hard', 'harsh', 'harvest',
            'hat', 'have', 'hawk', 'hazard', 'head', 'health', 'heart', 'heavy', 'hedgehog', 'height',
            'hello', 'helmet', 'help', 'hen', 'hero', 'hidden', 'high', 'hill', 'hint', 'hip',
            'hire', 'history', 'hobby', 'hockey', 'hold', 'hole', 'holiday', 'hollow', 'home', 'honey',
            'hood', 'hope', 'horn', 'horror', 'horse', 'hospital', 'host', 'hotel', 'hour', 'hover',
            'hub', 'huge', 'human', 'humble', 'humor', 'hundred', 'hungry', 'hunt', 'hurdle', 'hurry',
            'hurt', 'husband', 'hybrid', 'ice', 'icon', 'idea', 'identify', 'idle', 'ignore', 'ill',
            'illegal', 'illness', 'image', 'imitate', 'immense', 'immune', 'impact', 'impose', 'improve', 'impulse',
            'inch', 'include', 'income', 'increase', 'index', 'indicate', 'indoor', 'industry', 'infant', 'inflict',
            'inform', 'inhale', 'inherit', 'initial', 'inject', 'injury', 'inmate', 'inner', 'innocent', 'input',
            'inquiry', 'insane', 'insect', 'inside', 'inspire', 'install', 'intact', 'interest', 'into', 'invest',
            'invite', 'involve', 'iron', 'island', 'isolate', 'issue', 'item', 'ivory', 'jacket', 'jaguar',
            'jar', 'jazz', 'jealous', 'jeans', 'jelly', 'jewel', 'job', 'join', 'joke', 'journey',
            'joy', 'judge', 'juice', 'jump', 'jungle', 'junior', 'junk', 'just', 'kangaroo', 'keen',
            'keep', 'ketchup', 'key', 'kick', 'kid', 'kidney', 'kind', 'kingdom', 'kiss', 'kit',
            'kitchen', 'kite', 'kitten', 'kiwi', 'knee', 'knife', 'knock', 'know', 'lab', 'label',
            'labor', 'ladder', 'lady', 'lake', 'lamp', 'language', 'laptop', 'large', 'later', 'latin',
            'laugh', 'laundry', 'lava', 'law', 'lawn', 'lawsuit', 'layer', 'lazy', 'leader', 'leaf',
            'learn', 'leave', 'lecture', 'left', 'leg', 'legal', 'legend', 'leisure', 'lemon', 'lend',
            'length', 'lens', 'leopard', 'lesson', 'letter', 'level', 'liar', 'liberty', 'library', 'license',
            'life', 'lift', 'light', 'like', 'limb', 'limit', 'link', 'lion', 'liquid', 'list',
            'little', 'live', 'lizard', 'load', 'loan', 'lobster', 'local', 'lock', 'logic', 'lonely',
            'long', 'loop', 'lottery', 'loud', 'lounge', 'love', 'loyal', 'lucky', 'luggage', 'lumber',
            'lunar', 'lunch', 'luxury', 'lying', 'machine', 'mad', 'magic', 'magnet', 'maid', 'mail',
            'main', 'major', 'make', 'mammal', 'man', 'manage', 'mandate', 'mango', 'mansion', 'manual',
            'maple', 'marble', 'march', 'margin', 'marine', 'market', 'marriage', 'mask', 'mass', 'master',
            'match', 'material', 'math', 'matrix', 'matter', 'maximum', 'maze', 'meadow', 'mean', 'measure',
            'meat', 'mechanic', 'medal', 'media', 'melody', 'melt', 'member', 'memory', 'mention', 'menu',
            'mercy', 'merge', 'merit', 'merry', 'mesh', 'message', 'metal', 'method', 'middle', 'midnight',
            'milk', 'million', 'mimic', 'mind', 'minimum', 'minor', 'minute', 'miracle', 'mirror', 'misery',
            'miss', 'mistake', 'mix', 'mixed', 'mixture', 'mobile', 'model', 'modify', 'mom', 'moment',
            'monitor', 'monkey', 'monster', 'month', 'mood', 'moon', 'moral', 'more', 'morning', 'mosquito',
            'mother', 'motion', 'motor', 'mountain', 'mouse', 'move', 'movie', 'much', 'muffin', 'mule',
            'multiply', 'muscle', 'museum', 'mushroom', 'music', 'must', 'mutual', 'myself', 'mystery', 'myth',
            'naive', 'name', 'napkin', 'narrow', 'nasty', 'nation', 'nature', 'near', 'neck', 'need',
            'needle', 'neglect', 'neighbor', 'neither', 'nephew', 'nerve', 'nest', 'net', 'network', 'neutral',
            'never', 'news', 'next', 'nice', 'night', 'noble', 'noise', 'nominee', 'noodle', 'normal',
            'north', 'nose', 'notable', 'note', 'nothing', 'notice', 'novel', 'now', 'nuclear', 'number',
            'nurse', 'nut', 'oak', 'obey', 'object', 'oblige', 'obscure', 'observe', 'obtain', 'obvious',
            'occur', 'ocean', 'october', 'odor', 'off', 'offer', 'office', 'often', 'oil', 'okay',
            'old', 'olive', 'olympic', 'omit', 'once', 'one', 'onion', 'online', 'only', 'open',
            'opera', 'opinion', 'oppose', 'option', 'orange', 'orbit', 'orchard', 'order', 'ordinary', 'organ',
            'orient', 'original', 'orphan', 'ostrich', 'other', 'outdoor', 'outer', 'output', 'outside', 'oval',
            'oven', 'over', 'own', 'owner', 'oxygen', 'oyster', 'ozone', 'pact', 'paddle', 'page',
            'pair', 'palace', 'palm', 'panda', 'panel', 'panic', 'panther', 'paper', 'parade', 'parent',
            'park', 'parrot', 'part', 'party', 'pass', 'patch', 'path', 'patient', 'patrol', 'pattern',
            'pause', 'pave', 'payment', 'peace', 'peanut', 'pear', 'peasant', 'pelican', 'pen', 'penalty',
            'pencil', 'people', 'pepper', 'perfect', 'permit', 'person', 'pet', 'phone', 'photo', 'phrase',
            'physical', 'piano', 'picnic', 'picture', 'piece', 'pig', 'pigeon', 'pill', 'pilot', 'pink',
            'pioneer', 'pipe', 'pistol', 'pitch', 'pizza', 'place', 'planet', 'plastic', 'plate', 'play',
            'please', 'pledge', 'pluck', 'plug', 'plunge', 'poem', 'poet', 'point', 'polar', 'pole',
            'police', 'pond', 'pony', 'pool', 'popular', 'portion', 'position', 'possible', 'post', 'potato',
            'pottery', 'poverty', 'powder', 'power', 'practice', 'praise', 'predict', 'prefer', 'prepare', 'present',
            'pretty', 'prevent', 'price', 'pride', 'primary', 'print', 'priority', 'prison', 'private', 'prize',
            'problem', 'process', 'produce', 'profit', 'program', 'project', 'promote', 'proof', 'property', 'prosper',
            'protect', 'proud', 'provide', 'public', 'pudding', 'pull', 'pulp', 'pulse', 'pumpkin', 'punch',
            'pupil', 'puppy', 'purchase', 'purity', 'purpose', 'purse', 'push', 'put', 'puzzle', 'pyramid',
            'quality', 'quantum', 'quarter', 'question', 'quick', 'quiet', 'quilt', 'quit', 'quiz', 'quote',
            'rabbit', 'raccoon', 'race', 'rack', 'radar', 'radio', 'rail', 'rain', 'raise', 'rally',
            'ramp', 'ranch', 'random', 'range', 'rapid', 'rare', 'rate', 'rather', 'raven', 'raw',
            'razor', 'ready', 'real', 'reason', 'rebel', 'rebuild', 'recall', 'receive', 'recipe', 'record',
            'recycle', 'reduce', 'reflect', 'reform', 'refuse', 'region', 'regret', 'regular', 'reject', 'relax',
            'release', 'relief', 'rely', 'remain', 'remember', 'remind', 'remove', 'render', 'renew', 'rent',
            'reopen', 'repair', 'repeat', 'replace', 'report', 'require', 'rescue', 'resemble', 'resist', 'resource',
            'response', 'result', 'retire', 'retreat', 'return', 'reunion', 'reveal', 'review', 'reward', 'rhythm',
            'rib', 'ribbon', 'rice', 'rich', 'ride', 'ridge', 'rifle', 'right', 'rigid', 'ring',
            'riot', 'ripple', 'rise', 'risk', 'ritual', 'rival', 'river', 'road', 'roast', 'rob',
            'robot', 'robust', 'rocket', 'romance', 'roof', 'rookie', 'room', 'rose', 'rotate', 'rough',
            'round', 'route', 'royal', 'rubber', 'rude', 'rug', 'rule', 'run', 'runway', 'rural',
            'sad', 'saddle', 'sadness', 'safe', 'sail', 'salad', 'salmon', 'salon', 'salt', 'salute',
            'same', 'sample', 'sand', 'satisfy', 'satoshi', 'sauce', 'sausage', 'save', 'say', 'scale',
            'scan', 'scare', 'scatter', 'scene', 'scheme', 'school', 'science', 'scissors', 'scorpion', 'scout',
            'scrap', 'screen', 'script', 'scrub', 'sea', 'search', 'season', 'seat', 'second', 'secret',
            'section', 'security', 'seed', 'seek', 'segment', 'select', 'sell', 'seminar', 'senior', 'sense',
            'sentence', 'series', 'service', 'session', 'settle', 'setup', 'seven', 'shadow', 'shaft', 'shallow',
            'share', 'shed', 'shell', 'sheriff', 'shield', 'shift', 'shine', 'ship', 'shirt', 'shock',
            'shoe', 'shoot', 'shop', 'short', 'shoulder', 'shove', 'shrimp', 'shrug', 'shuffle', 'sick',
            'side', 'siege', 'sight', 'sign', 'silent', 'silk', 'silly', 'silver', 'similar', 'simple',
            'since', 'sing', 'siren', 'sister', 'situate', 'six', 'size', 'skate', 'sketch', 'ski',
            'skill', 'skin', 'skirt', 'skull', 'slab', 'slam', 'sleep', 'slender', 'slice', 'slide',
            'slight', 'slim', 'slogan', 'slot', 'slow', 'slush', 'small', 'smart', 'smile', 'smoke',
            'smooth', 'snack', 'snake', 'snap', 'sniff', 'snow', 'soap', 'soccer', 'social', 'sock',
            's
