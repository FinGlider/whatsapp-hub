const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const BusinessAccount = require("./BusinessAccount");

const App = sequelize.define(
  "App",
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    businessId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "business_id",
      references: {
        model: "business_accounts",
        key: "business_id",
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    verifyToken: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: "verify_token",
    },
  },
  {
    tableName: "apps",
    timestamps: true,
  }
);

// Relationships
App.belongsTo(BusinessAccount, {
  foreignKey: "businessId",
  as: "businessAccount",
});

BusinessAccount.hasMany(App, {
  foreignKey: "businessId",
  as: "apps",
});

module.exports = App;
