const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const PhoneNumber = require("./PhoneNumber");
const Project = require("./Project");

const PhoneNumberProject = sequelize.define(
  "PhoneNumberProject",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    phoneNumberId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "phone_number_id",
      references: {
        model: "phone_numbers",
        key: "phone_number_id",
      },
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "project_id",
      references: {
        model: "projects",
        key: "id",
      },
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "phone_number_projects",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["phone_number_id", "project_id"],
      },
    ],
  }
);

// Many-to-Many Relationships
PhoneNumber.belongsToMany(Project, {
  through: PhoneNumberProject,
  foreignKey: "phoneNumberId",
  otherKey: "projectId",
  as: "projects",
});

Project.belongsToMany(PhoneNumber, {
  through: PhoneNumberProject,
  foreignKey: "projectId",
  otherKey: "phoneNumberId",
  as: "phoneNumbers",
});

// Direct associations for easier querying
PhoneNumberProject.belongsTo(PhoneNumber, {
  foreignKey: "phoneNumberId",
  as: "phoneNumber",
});

PhoneNumberProject.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project",
});

module.exports = PhoneNumberProject;
