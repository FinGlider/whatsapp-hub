# Quick Setup Guide

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up PostgreSQL Database

```bash
# Create database
createdb whatsapp_hub

# Copy environment file
cp .env.example .env

# Edit .env and add your DATABASE_URL
# Example: DATABASE_URL=postgresql://localhost:5432/whatsapp_hub
```

## Step 3: Run Database Migration

```bash
npm run db:migrate
```

This will create all tables and insert sample data.

## Step 4: Start Redis

```bash
# macOS with Homebrew
brew services start redis

# Or run directly
redis-server
```

## Step 5: Update .env File

```env
PORT=3138
NODE_ENV=development

# Database
DATABASE_URL=postgresql://localhost:5432/whatsapp_hub

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Step 6: Start the Application

```bash
# Development mode with auto-reload
npm run dev

# Or production mode
npm start
```

## Step 7: Test the Setup

```bash
# Check health
curl http://localhost:3138/admin/health

# List business accounts (should show sample data)
curl http://localhost:3138/admin/business-accounts

# List projects
curl http://localhost:3138/admin/projects
```

## Step 8: Configure Your First Phone Number

### Option A: Use Sample Data

The migration already created sample data with:

- Business Account: `123456789` (FinGlider Company)
- App: `promotion-app` with verify token `hafis`
- Phone Number: `542491768952983`
- 2 Projects mapped to the phone number

### Option B: Create Your Own

```bash
# 1. Create business account
curl -X POST http://localhost:3138/admin/business-accounts \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "YOUR_WABA_ID",
    "name": "My Business"
  }'

# 2. Create app
curl -X POST http://localhost:3138/admin/apps \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-app",
    "business_id": "YOUR_WABA_ID",
    "name": "My App",
    "verify_token": "my-secret-token"
  }'

# 3. Add phone number
curl -X POST http://localhost:3138/admin/phone-numbers \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number_id": "YOUR_PHONE_NUMBER_ID",
    "app_id": "my-app",
    "phone_number": "+1234567890",
    "display_name": "Main Line"
  }'

# 4. Create project
curl -X POST http://localhost:3138/admin/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Backend",
    "endpoint": "https://myapi.example.com/webhook",
    "description": "My service endpoint"
  }'

# 5. Map phone to project (get project_id from step 4 response)
curl -X POST http://localhost:3138/admin/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number_id": "YOUR_PHONE_NUMBER_ID",
    "project_id": 1,
    "priority": 100
  }'
```

## Step 9: Configure Meta Webhook

1. Go to https://developers.facebook.com
2. Select your app
3. Go to WhatsApp > Configuration
4. Set Webhook URL: `https://your-domain.com/meta/webhook`
5. Set Verify Token: The value from your app's `verify_token` in database
6. Click "Verify and Save"
7. Subscribe to webhook fields (messages, message_status, etc.)

## Troubleshooting

### Database Connection Error

```bash
# Make sure PostgreSQL is running
pg_isready

# Check if database exists
psql -l | grep whatsapp_hub
```

### Redis Connection Error

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

### Port Already in Use

```bash
# Change PORT in .env file to a different port
PORT=3139
```

## Next Steps

- Set up HTTPS for production (use nginx or similar)
- Deploy to cloud (AWS, Azure, DigitalOcean, etc.)
- Set up monitoring (PM2, New Relic, etc.)
- Configure firewall rules
- Set up backup for PostgreSQL
- Configure Redis persistence

## Support

For issues or questions, check the main README.md file.
