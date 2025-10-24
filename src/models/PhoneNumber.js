const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const App = require("./App");

const PhoneNumber = sequelize.define(
  "PhoneNumber",
  {
    phoneNumberId: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      field: "phone_number_id",
    },
    appId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "app_id",
      references: {
        model: "apps",
        key: "id",
      },
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      field: "phone_number",
    },
    displayName: {
      type: DataTypes.STRING(100),
      field: "display_name",
    },
  },
  {
    tableName: "phone_numbers",
    timestamps: true,
  }
);

// Relationships
PhoneNumber.belongsTo(App, {
  foreignKey: "appId",
  as: "app",
});

App.hasMany(PhoneNumber, {
  foreignKey: "appId",
  as: "phoneNumbers",
});

module.exports = PhoneNumber;
