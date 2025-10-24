const express = require("express");
const router = express.Router();
const db = require("../services/db.service");
const {
  invalidatePhoneCache,
  clearAllCache,
  getCacheStats,
} = require("../services/cache.service");
const { getQueueStats } = require("../services/queue.service");

// ============= Business Accounts =============

// Get all business accounts
router.get("/business-accounts", async (req, res) => {
  try {
    const accounts = await db.getAllBusinessAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create business account
router.post("/business-accounts", async (req, res) => {
  try {
    const account = await db.createBusinessAccount(req.body);
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= Apps =============

// Get apps for a business account
router.get("/business-accounts/:businessId/apps", async (req, res) => {
  try {
    const apps = await db.getAppsByBusinessId(req.params.businessId);
    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create app
router.post("/apps", async (req, res) => {
  try {
    const app = await db.createApp(req.body);
    res.status(201).json(app);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= Phone Numbers =============

// Get phone numbers for an app
router.get("/apps/:appId/phone-numbers", async (req, res) => {
  try {
    const phoneNumbers = await db.getPhoneNumbersByAppId(req.params.appId);
    res.json(phoneNumbers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create phone number
router.post("/phone-numbers", async (req, res) => {
  try {
    const phoneNumber = await db.createPhoneNumber(req.body);
    res.status(201).json(phoneNumber);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get project mappings for a phone number
router.get("/phone-numbers/:phoneNumberId/projects", async (req, res) => {
  try {
    const mappings = await db.getProjectMappingsByPhoneNumber(
      req.params.phoneNumberId
    );
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= Projects =============

// Get all projects
router.get("/projects", async (req, res) => {
  try {
    const projects = await db.getAllProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project
router.post("/projects", async (req, res) => {
  try {
    const project = await db.createProject(req.body);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= Phone Number to Project Mappings =============

// Map phone number to project
router.post("/mappings", async (req, res) => {
  try {
    const { phone_number_id, project_id, priority } = req.body;

    const mapping = await db.mapPhoneNumberToProject({
      phone_number_id,
      project_id,
      priority,
    });

    // Invalidate cache for this phone number
    invalidatePhoneCache(phone_number_id);

    res.status(201).json(mapping);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove mapping
router.delete("/mappings/:phoneNumberId/:projectId", async (req, res) => {
  try {
    const { phoneNumberId, projectId } = req.params;

    const result = await db.unmapPhoneNumberFromProject(
      phoneNumberId,
      projectId
    );

    // Invalidate cache for this phone number
    invalidatePhoneCache(phoneNumberId);

    if (result) {
      res.json({ message: "Mapping removed successfully" });
    } else {
      res.status(404).json({ error: "Mapping not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= System Management =============

// Clear cache
router.post("/system/cache/clear", async (req, res) => {
  try {
    clearAllCache();
    res.json({ message: "Cache cleared successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cache stats
router.get("/system/cache/stats", async (req, res) => {
  try {
    const stats = getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue stats
router.get("/system/queue/stats", async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
router.get("/health", async (req, res) => {
  try {
    // Test database connection
    await db.sequelize.authenticate();

    const cacheStats = getCacheStats();
    const queueStats = await getQueueStats();

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        keys: cacheStats.keys,
      },
      queue: queueStats,
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

module.exports = router;
