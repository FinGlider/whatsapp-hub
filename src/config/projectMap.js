const projects = {
  542491768952983: {
    phoneNumberId: 542491768952983,
    name: "WA PROMOTION",
    endpoint: "https://wapromoapi.finglider.com/whatsapp-webhook",
  },
};

// Validate project configuration
Object.entries(projects).forEach(([key, project]) => {
  if (!project.phoneNumberId || !project.name || !project.endpoint) {
    throw new Error(`Invalid project configuration for ID: ${key}`);
  }
  if (parseInt(key) !== project.phoneNumberId) {
    throw new Error(`Phone number ID mismatch for project: ${project.name}`);
  }
});

module.exports = projects;
