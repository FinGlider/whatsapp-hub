const { sequelize } = require("../config/database");
const {
  BusinessAccount,
  App,
  PhoneNumber,
  Project,
  PhoneNumberProject,
} = require("../models");

/**
 * Get all projects mapped to a phone number ID
 * @param {string} phoneNumberId - The phone number ID from Meta
 * @returns {Promise<Array>} Array of project objects
 */
exports.getProjectsFromPhoneNumberId = async (phoneNumberId) => {
  try {
    const mappings = await PhoneNumberProject.findAll({
      where: {
        phoneNumberId,
        isActive: true,
      },
      include: [
        {
          model: PhoneNumber,
          as: "phoneNumber",
          include: [
            {
              model: App,
              as: "app",
              include: [
                {
                  model: BusinessAccount,
                  as: "businessAccount",
                },
              ],
            },
          ],
        },
        {
          model: Project,
          as: "project",
          where: {
            isActive: true,
          },
        },
      ],
      order: [
        ["priority", "DESC"],
        [{ model: Project, as: "project" }, "name", "ASC"],
      ],
    });

    return mappings.map((mapping) => ({
      phoneNumberId: mapping.phoneNumber.phoneNumberId,
      phoneNumber: mapping.phoneNumber.phoneNumber,
      displayName: mapping.phoneNumber.displayName,
      appId: mapping.phoneNumber.app.id,
      appName: mapping.phoneNumber.app.name,
      verifyToken: mapping.phoneNumber.app.verifyToken,
      businessId: mapping.phoneNumber.app.businessAccount.businessId,
      businessName: mapping.phoneNumber.app.businessAccount.name,
      projectId: mapping.project.id,
      projectName: mapping.project.name,
      endpoint: mapping.project.endpoint,
      isActive: mapping.project.isActive,
      priority: mapping.priority,
    }));
  } catch (error) {
    console.error("Database error in getProjectsFromPhoneNumberId:", error);
    return [];
  }
};

/**
 * Get app by verify token
 * @param {string} token - The verify token
 * @returns {Promise<Object|null>} App object or null
 */
exports.getAppByVerifyToken = async (token) => {
  try {
    const app = await App.findOne({
      where: { verifyToken: token },
      include: [
        {
          model: BusinessAccount,
          as: "businessAccount",
        },
      ],
    });

    if (!app) return null;

    return {
      appId: app.id,
      appName: app.name,
      verifyToken: app.verifyToken,
      businessId: app.businessAccount.businessId,
      businessName: app.businessAccount.name,
    };
  } catch (error) {
    console.error("Database error in getAppByVerifyToken:", error);
    return null;
  }
};

/**
 * Get all business accounts
 */
exports.getAllBusinessAccounts = async () => {
  try {
    const accounts = await BusinessAccount.findAll({
      attributes: ["businessId", "name", "timezone", "createdAt"],
      order: [["name", "ASC"]],
    });
    return accounts.map((acc) => acc.toJSON());
  } catch (error) {
    console.error("Database error:", error);
    return [];
  }
};

/**
 * Create a new business account
 */
exports.createBusinessAccount = async (businessData) => {
  const { business_id, name, timezone = "UTC" } = businessData;
  try {
    const account = await BusinessAccount.create({
      businessId: business_id,
      name,
      timezone,
    });
    return account.toJSON();
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
};

/**
 * Get all apps for a business account
 */
exports.getAppsByBusinessId = async (businessId) => {
  try {
    const apps = await App.findAll({
      where: { businessId },
      attributes: ["id", "businessId", "name", "verifyToken", "createdAt"],
      order: [["name", "ASC"]],
    });
    return apps.map((app) => app.toJSON());
  } catch (error) {
    console.error("Database error:", error);
    return [];
  }
};

/**
 * Create a new app
 */
exports.createApp = async (appData) => {
  const { id, business_id, name, verify_token } = appData;
  try {
    const app = await App.create({
      id,
      businessId: business_id,
      name,
      verifyToken: verify_token,
    });
    return app.toJSON();
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
};

/**
 * Get all phone numbers for an app
 */
exports.getPhoneNumbersByAppId = async (appId) => {
  try {
    const phoneNumbers = await PhoneNumber.findAll({
      where: { appId },
      include: [
        {
          model: Project,
          as: "projects",
          through: {
            where: { isActive: true },
            attributes: [],
          },
          attributes: ["id"],
        },
      ],
      order: [["displayName", "ASC"]],
    });

    return phoneNumbers.map((pn) => ({
      phone_number_id: pn.phoneNumberId,
      phone_number: pn.phoneNumber,
      display_name: pn.displayName,
      app_id: pn.appId,
      project_count: pn.projects ? pn.projects.length : 0,
    }));
  } catch (error) {
    console.error("Database error:", error);
    return [];
  }
};

/**
 * Create a new phone number
 */
exports.createPhoneNumber = async (phoneData) => {
  const { phone_number_id, app_id, phone_number, display_name } = phoneData;
  try {
    const phoneNumber = await PhoneNumber.create({
      phoneNumberId: phone_number_id,
      appId: app_id,
      phoneNumber: phone_number,
      displayName: display_name,
    });
    return phoneNumber.toJSON();
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
};

/**
 * Get all projects
 */
exports.getAllProjects = async () => {
  try {
    const projects = await Project.findAll({
      attributes: [
        "id",
        "name",
        "endpoint",
        "description",
        "isActive",
        "createdAt",
      ],
      order: [["name", "ASC"]],
    });
    return projects.map((proj) => proj.toJSON());
  } catch (error) {
    console.error("Database error:", error);
    return [];
  }
};

/**
 * Create a new project
 */
exports.createProject = async (projectData) => {
  const { name, endpoint, description, is_active = true } = projectData;
  try {
    const project = await Project.create({
      name,
      endpoint,
      description,
      isActive: is_active,
    });
    return project.toJSON();
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
};

/**
 * Map a phone number to a project
 */
exports.mapPhoneNumberToProject = async (mappingData) => {
  const { phone_number_id, project_id, priority = 0 } = mappingData;
  try {
    const [mapping, created] = await PhoneNumberProject.findOrCreate({
      where: {
        phoneNumberId: phone_number_id,
        projectId: project_id,
      },
      defaults: {
        phoneNumberId: phone_number_id,
        projectId: project_id,
        priority,
        isActive: true,
      },
    });

    if (!created) {
      // Update existing mapping
      await mapping.update({
        priority,
        isActive: true,
      });
    }

    return mapping.toJSON();
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
};

/**
 * Remove mapping between phone number and project
 */
exports.unmapPhoneNumberFromProject = async (phoneNumberId, projectId) => {
  try {
    const mapping = await PhoneNumberProject.findOne({
      where: {
        phoneNumberId,
        projectId,
      },
    });

    if (mapping) {
      await mapping.update({ isActive: false });
      return mapping.toJSON();
    }

    return null;
  } catch (error) {
    console.error("Database error:", error);
    throw error;
  }
};

/**
 * Get all project mappings for a phone number
 */
exports.getProjectMappingsByPhoneNumber = async (phoneNumberId) => {
  try {
    const mappings = await PhoneNumberProject.findAll({
      where: { phoneNumberId },
      include: [
        {
          model: Project,
          as: "project",
        },
      ],
      order: [
        ["priority", "DESC"],
        [{ model: Project, as: "project" }, "name", "ASC"],
      ],
    });

    return mappings.map((mapping) => ({
      id: mapping.id,
      phone_number_id: mapping.phoneNumberId,
      project_id: mapping.projectId,
      priority: mapping.priority,
      is_active: mapping.isActive,
      project_name: mapping.project.name,
      endpoint: mapping.project.endpoint,
      description: mapping.project.description,
    }));
  } catch (error) {
    console.error("Database error:", error);
    return [];
  }
};

module.exports.sequelize = sequelize;
