const Bull = require("bull");
const axios = require("axios");

// Create queue for webhook forwarding with retry logic
const webhookQueue = new Bull("webhook-forwarding", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
});

// Process webhook forwarding jobs
webhookQueue.process(async (job) => {
  const { endpoint, payload, projectName, phoneNumberId } = job.data;

  console.log(`📤 Forwarding webhook to ${projectName} (${endpoint})`);

  try {
    const response = await axios.post(endpoint, payload, {
      timeout: 10000, // 10 second timeout
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "WhatsApp-Hub/1.0",
        "X-Phone-Number-ID": phoneNumberId,
      },
    });

    console.log(
      `✅ Successfully forwarded to ${projectName} - Status: ${response.status}`
    );
    return { success: true, status: response.status };
  } catch (error) {
    console.error(`❌ Failed to forward to ${projectName}:`, error.message);

    // Throw error to trigger Bull's retry mechanism
    throw new Error(
      `Failed to forward webhook to ${endpoint}: ${error.message}`
    );
  }
});

// Event listeners for monitoring
webhookQueue.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completed for ${job.data.projectName}`);
});

webhookQueue.on("failed", (job, err) => {
  console.error(
    `❌ Job ${job.id} failed for ${job.data.projectName}:`,
    err.message
  );
});

webhookQueue.on("stalled", (job) => {
  console.warn(`⚠️  Job ${job.id} stalled for ${job.data.projectName}`);
});

/**
 * Add webhook to forwarding queue
 * @param {Object} options - Forwarding options
 * @param {string} options.endpoint - The endpoint URL to forward to
 * @param {Object} options.payload - The webhook payload
 * @param {string} options.projectName - Name of the project
 * @param {string} options.phoneNumberId - Phone number ID
 * @returns {Promise<Object>} Job object
 */
exports.queueWebhook = async ({
  endpoint,
  payload,
  projectName,
  phoneNumberId,
}) => {
  return await webhookQueue.add(
    { endpoint, payload, projectName, phoneNumberId },
    {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: "exponential",
        delay: 2000, // Start with 2 seconds, then 4s, 8s
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 500, // Keep last 500 failed jobs for debugging
    }
  );
};

/**
 * Get queue stats
 */
exports.getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    webhookQueue.getWaitingCount(),
    webhookQueue.getActiveCount(),
    webhookQueue.getCompletedCount(),
    webhookQueue.getFailedCount(),
    webhookQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
};

module.exports.webhookQueue = webhookQueue;
