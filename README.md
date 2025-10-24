# WhatsApp Hub - Multi-Tenant Webhook Router

A production-ready WhatsApp webhook hub that routes incoming Meta webhooks to multiple backend services based on phone number configuration. Supports multiple Meta apps, business accounts, and phone numbers with database-driven configuration.

## 🎯 Key Features

- **Multi-tenant support**: One phone number can forward to multiple projects
- **Database-driven configuration**: No code changes needed to add new apps/projects
- **Caching layer**: Reduces database load with intelligent caching
- **Queue system**: Reliable webhook forwarding with automatic retries
- **Admin API**: RESTful API for managing configurations
- **Production-ready**: Error handling, logging, and monitoring built-in

## 📊 Architecture

```
Meta WhatsApp API
       ↓
WhatsApp Hub (Single Webhook Endpoint)
       ↓
   Database Lookup (with caching)
       ↓
   Queue System (Bull + Redis)
       ↓
Multiple Backend Services (Projects)
```

## 🗄️ Database Schema

### Hierarchy

```
Business Account (WABA)
  └── App (Meta App)
      └── Phone Number
          └── Projects (Many-to-Many)
```

### Tables

- `business_accounts` - WhatsApp Business Accounts
- `apps` - Meta apps with verify tokens
- `phone_numbers` - Phone numbers linked to apps
- `projects` - Your backend services/endpoints
- `phone_number_projects` - Mapping table (many-to-many)

## 🚀 Getting Started

### Prerequisites

- Node.js >= 16
- PostgreSQL >= 12
- Redis >= 6 (for queue system)

### Installation

1. **Clone and install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your database and Redis credentials
   ```

3. **Set up database**

   ```bash
   # Create database
   createdb whatsapp_hub

   # Run migrations
   npm run db:migrate
   ```

4. **Start Redis** (if not already running)

   ```bash
   redis-server
   ```

5. **Start the application**

   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

## 📡 API Endpoints

### Webhook Endpoints

- `GET /meta/webhook` - Meta webhook verification
- `POST /meta/webhook` - Receive webhooks from Meta

### Admin API

#### Business Accounts

- `GET /admin/business-accounts` - List all business accounts
- `POST /admin/business-accounts` - Create business account

#### Apps

- `GET /admin/business-accounts/:businessId/apps` - List apps
- `POST /admin/apps` - Create app

#### Phone Numbers

- `GET /admin/apps/:appId/phone-numbers` - List phone numbers
- `POST /admin/phone-numbers` - Create phone number
- `GET /admin/phone-numbers/:phoneNumberId/projects` - List project mappings

#### Projects

- `GET /admin/projects` - List all projects
- `POST /admin/projects` - Create project

#### Mappings

- `POST /admin/mappings` - Map phone number to project
- `DELETE /admin/mappings/:phoneNumberId/:projectId` - Remove mapping

#### System

- `GET /admin/health` - Health check with system stats
- `GET /admin/system/cache/stats` - Cache statistics
- `GET /admin/system/queue/stats` - Queue statistics
- `POST /admin/system/cache/clear` - Clear cache

## 🔧 Configuration Examples

### 1. Create a Business Account

```bash
curl -X POST http://localhost:3138/admin/business-accounts \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "123456789",
    "name": "FinGlider Company",
    "timezone": "America/New_York"
  }'
```

### 2. Create an App

```bash
curl -X POST http://localhost:3138/admin/apps \
  -H "Content-Type: application/json" \
  -d '{
    "id": "promotion-app",
    "business_id": "123456789",
    "name": "Promotion App",
    "verify_token": "your-unique-verify-token"
  }'
```

### 3. Add a Phone Number

```bash
curl -X POST http://localhost:3138/admin/phone-numbers \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number_id": "542491768952983",
    "app_id": "promotion-app",
    "phone_number": "+1234567890",
    "display_name": "Main Business Line"
  }'
```

### 4. Create a Project

```bash
curl -X POST http://localhost:3138/admin/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WA Promotion Service",
    "endpoint": "https://wapromoapi.finglider.com/whatsapp-webhook",
    "description": "Handles promotional campaigns"
  }'
```

### 5. Map Phone Number to Multiple Projects

```bash
# Map to first project (high priority)
curl -X POST http://localhost:3138/admin/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number_id": "542491768952983",
    "project_id": 1,
    "priority": 100
  }'

# Map to second project (lower priority)
curl -X POST http://localhost:3138/admin/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number_id": "542491768952983",
    "project_id": 2,
    "priority": 50
  }'
```

## 🔐 Setting Up Meta Webhook

1. Go to Meta Developer Portal
2. Select your app
3. Navigate to WhatsApp > Configuration
4. Set webhook URL: `https://your-domain.com/meta/webhook`
5. Use the verify token from your database (app's `verify_token` field)
6. Subscribe to webhook events

## 📈 How It Works

### Webhook Flow

1. **Meta sends webhook** to `https://your-domain.com/meta/webhook`
2. **Hub responds immediately** (within 20 seconds as required by Meta)
3. **Extract phone_number_id** from webhook payload
4. **Query database** (with caching) for mapped projects
5. **Queue webhooks** to all mapped project endpoints
6. **Bull processes queue** with automatic retries on failure

### Multiple Projects per Phone Number

When a phone number is mapped to multiple projects:

- Webhooks are forwarded to **all mapped projects**
- Projects are processed in **priority order** (higher priority first)
- Each forward attempt is **queued independently** with retry logic
- Failures in one project **don't affect others**

## 🛡️ Production Deployment

### Environment Variables

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

### Recommended Setup

- Use connection pooling for PostgreSQL
- Deploy Redis with persistence enabled
- Set up monitoring for queue metrics
- Enable HTTPS/SSL for webhooks
- Implement rate limiting if needed
- Use process manager (PM2, systemd)

### Scaling

- **Horizontal scaling**: Run multiple instances behind load balancer
- **Database**: Use read replicas for heavy read operations
- **Redis**: Use Redis Cluster for high availability
- **Caching**: Adjust TTL based on your update frequency

## 🐛 Troubleshooting

### Check system health

```bash
curl http://localhost:3138/admin/health
```

### View cache statistics

```bash
curl http://localhost:3138/admin/system/cache/stats
```

### View queue statistics

```bash
curl http://localhost:3138/admin/system/queue/stats
```

### Clear cache manually

```bash
curl -X POST http://localhost:3138/admin/system/cache/clear
```

## 📝 License

ISC
