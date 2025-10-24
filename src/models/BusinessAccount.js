const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const BusinessAccount = sequelize.define(
  "BusinessAccount",
  {
    businessId: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      field: "business_id",
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING(50),
      defaultValue: "UTC",
    },
  },
  {
    tableName: "business_accounts",
    timestamps: true,
  }
);

module.exports = BusinessAccount;
