const { queueWebhook } = require("./queue.service");

/**
 * Forward webhook to multiple projects
 * Uses queue system for reliable delivery with retries
 * @param {Array} projects - Array of project configurations
 * @param {Object} payload - Webhook payload from Meta
 * @returns {Promise<Object>} Result summary
 */
exports.forwardToProjects = async (projects, payload) => {
  if (!projects || projects.length === 0) {
    console.log("⚠️  No projects to forward to");
    return { success: false, count: 0, message: "No projects configured" };
  }

  const phoneNumberId =
    payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  console.log(`📨 Forwarding webhook to ${projects.length} project(s)`);

  const results = await Promise.allSettled(
    projects.map((project) =>
      queueWebhook({
        endpoint: project.endpoint,
        payload,
        projectName: project.projectName,
        phoneNumberId,
      })
    )
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`✅ Queued ${successful} webhooks, ${failed} failed`);

  return {
    success: successful > 0,
    total: projects.length,
    queued: successful,
    failed,
  };
};
