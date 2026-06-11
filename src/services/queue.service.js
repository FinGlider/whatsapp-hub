require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const Bull = require("bull");
const axios = require("axios");

const webhookQueue = new Bull("webhook-forwarding", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  limiter: {
    max: 75,
    duration: 1000,
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 1000, age: 3600 },
    removeOnFail: { count: 5000, age: 86400 },
  },
  settings: {
    lockDuration: 60000,
    stalledInterval: 30000,
    maxStalledCount: 1,
  },
});

webhookQueue.process(10, async (job) => {
  const { endpoint, payload, projectName, phoneNumberId } = job.data;

  try {
    const response = await axios.post(endpoint, payload, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "WhatsApp-Hub/1.0",
        "X-Phone-Number-ID": phoneNumberId,
        "X-Webhook-Forward-Secret": process.env.WEBHOOK_FORWARD_SECRET,
      },
    });

    console.log(`✅ Successfully forwarded to ${projectName} - Status: ${response.status}`);
    return { success: true, status: response.status };
  } catch (error) {
    console.error(`❌ Failed to forward to ${projectName}:`, error.message);
    throw new Error(`Failed to forward webhook to ${endpoint}: ${error.message}`);
  }
});

webhookQueue.on("stalled", (job) => {
  console.warn(`⚠️  Job ${job.id} stalled for ${job.data.projectName}`);
});

exports.queueWebhook = async ({ endpoint, payload, projectName, phoneNumberId }) => {
  return await webhookQueue.add({ endpoint, payload, projectName, phoneNumberId });
};

exports.getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    webhookQueue.getWaitingCount(),
    webhookQueue.getActiveCount(),
    webhookQueue.getCompletedCount(),
    webhookQueue.getFailedCount(),
    webhookQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
};

module.exports.webhookQueue = webhookQueue;
