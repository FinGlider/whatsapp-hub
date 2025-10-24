require("dotenv").config({ quiet: true });
const { sequelize } = require("./database");
const models = require("../models");

async function syncDatabase() {
  try {
    console.log("🔄 Connecting to MySQL database...");

    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log("\n🔄 Syncing database models...");

    // Sync all models with the database
    // force: false means it won't drop existing tables
    // alter: true means it will modify tables to match models
    await sequelize.sync({ alter: false });

    console.log("✅ Database models synced successfully");

    // Insert sample data if tables are empty
    await insertSampleData();

    console.log("\n✅ Database initialization complete!");
    console.log("\nYou can now start the application with:");
    console.log("  npm run dev");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error syncing database:", error);
    process.exit(1);
  }
}

async function insertSampleData() {
  const { BusinessAccount, App, PhoneNumber, Project, PhoneNumberProject } =
    models;

  try {
    // Check if data already exists
    const businessCount = await BusinessAccount.count();

    if (businessCount > 0) {
      console.log("\n⏭️  Sample data already exists, skipping...");
      return;
    }

    console.log("\n📝 Inserting sample data...");

    // Create business account
    const business = await BusinessAccount.create({
      businessId: "123456789",
      name: "FinGlider Company",
      timezone: "UTC",
    });
    console.log("✅ Created business account:", business.name);

    // Create app
    const app = await App.create({
      id: "promotion-app",
      businessId: business.businessId,
      name: "Promotion App",
      verifyToken: "hafis",
    });
    console.log("✅ Created app:", app.name);

    // Create phone number
    const phoneNumber = await PhoneNumber.create({
      phoneNumberId: "542491768952983",
      appId: app.id,
      phoneNumber: "+1234567890",
      displayName: "Main Business Number",
    });
    console.log("✅ Created phone number:", phoneNumber.displayName);

    // Create projects
    const project1 = await Project.create({
      name: "WA Promotion Service",
      endpoint: "https://wapromoapi.finglider.com/whatsapp-webhook",
      description: "Handles promotional campaigns",
      isActive: true,
    });
    console.log("✅ Created project:", project1.name);

    const project2 = await Project.create({
      name: "Appointment Service",
      endpoint: "https://appointmentApi.finglider.com/webhook/whatsapp-webhook",
      description: "Manages appointment bookings",
      isActive: true,
    });
    console.log("✅ Created project:", project2.name);

    // Map phone number to projects
    await PhoneNumberProject.create({
      phoneNumberId: phoneNumber.phoneNumberId,
      projectId: project1.id,
      priority: 100,
      isActive: true,
    });
    console.log("✅ Mapped phone number to:", project1.name);

    await PhoneNumberProject.create({
      phoneNumberId: phoneNumber.phoneNumberId,
      projectId: project2.id,
      priority: 50,
      isActive: true,
    });
    console.log("✅ Mapped phone number to:", project2.name);

    console.log("\n✅ Sample data inserted successfully!");
  } catch (error) {
    console.error("❌ Error inserting sample data:", error);
  }
}

// Run the sync
syncDatabase();
