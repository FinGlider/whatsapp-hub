const NodeCache = require("node-cache");

// Cache phone number lookups for 1 hour (3600 seconds)
const phoneCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false, // Don't clone objects (better performance)
});

/**
 * Get project configurations with caching
 * @param {string} phoneNumberId - Phone number ID
 * @param {Function} fetchFunction - Function to fetch from database if cache miss
 * @returns {Promise<Array>} Array of projects
 */
exports.getCachedProjects = async (phoneNumberId, fetchFunction) => {
  const cacheKey = `phone:${phoneNumberId}`;

  // Check cache first
  let projects = phoneCache.get(cacheKey);

  if (projects === undefined) {
    console.log(`Cache MISS for phone number: ${phoneNumberId}`);

    // Cache miss - fetch from database
    projects = await fetchFunction(phoneNumberId);

    if (projects && projects.length > 0) {
      phoneCache.set(cacheKey, projects);
      console.log(
        `Cached ${projects.length} projects for phone number: ${phoneNumberId}`
      );
    }
  } else {
    console.log(`Cache HIT for phone number: ${phoneNumberId}`);
  }

  return projects || [];
};

/**
 * Invalidate cache for a specific phone number
 * @param {string} phoneNumberId - Phone number ID
 */
exports.invalidatePhoneCache = (phoneNumberId) => {
  const cacheKey = `phone:${phoneNumberId}`;
  const deleted = phoneCache.del(cacheKey);

  if (deleted > 0) {
    console.log(`Invalidated cache for phone number: ${phoneNumberId}`);
  }

  return deleted > 0;
};

/**
 * Clear all cache
 */
exports.clearAllCache = () => {
  phoneCache.flushAll();
  console.log("All cache cleared");
};

/**
 * Get cache statistics
 */
exports.getCacheStats = () => {
  return phoneCache.getStats();
};

/**
 * Get all cached keys
 */
exports.getCachedKeys = () => {
  return phoneCache.keys();
};

module.exports.phoneCache = phoneCache;
