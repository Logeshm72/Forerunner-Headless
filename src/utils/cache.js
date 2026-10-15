const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(process.cwd(), '.forerunner-cache.json');
const TTL = parseInt(process.env.CACHE_TTL) || 3600; // 1 hour default

function saveCache(key, data) {
  let cache = {};

  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (error) {
      console.warn('Could not read cache file, creating new cache');
    }
  }

  cache[key] = {
    data,
    timestamp: Date.now()
  };

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function loadCache(key) {
  if (!fs.existsSync(CACHE_FILE)) {
    return null;
  }

  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const entry = cache[key];

    if (!entry) {
      return null;
    }

    // Check if expired
    const age = (Date.now() - entry.timestamp) / 1000;
    if (age > TTL && process.env.CACHE_ENABLED !== 'false') {
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('Error reading cache:', error.message);
    return null;
  }
}

function clearCache() {
  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE);
  }
}

module.exports = {
  saveCache,
  loadCache,
  clearCache
};
