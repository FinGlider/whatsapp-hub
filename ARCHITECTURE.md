# WhatsApp Hub Architecture Explained

## Database Structure Clarification

### Understanding the IDs

#### 1. **Business Account ID** (`business_id`)

- **What it is**: The WhatsApp Business Account ID (WABA ID) from Meta
- **Where it comes from**: Meta Developer Portal > Your App > WhatsApp Business Account
- **Primary key in**: `business_accounts` table
- **Example**: `123456789`

#### 2. **App ID** (`id`)

- **What it is**: A unique identifier for a Meta app within your system
- **Where it comes from**: You create this (can be descriptive like "promotion-app")
- **Primary key in**: `apps` table
- **Example**: `promotion-app`, `support-app`, `sales-app`

#### 3. **Phone Number ID** (`phone_number_id`)

- **What it is**: The unique ID for a phone number from Meta
- **Where it comes from**: Meta Developer Portal > WhatsApp > Phone Numbers
- **Primary key in**: `phone_numbers` table
- **Example**: `542491768952983`

#### 4. **Project ID** (`id`)

- **What it is**: Auto-incrementing ID for your backend services
- **Where it comes from**: Auto-generated when you create a project
- **Primary key in**: `projects` table
- **Example**: `1`, `2`, `3`

## Table Relationships

```
business_accounts (WABA from Meta)
├── business_id: "123456789" (WABA ID)
├── name: "FinGlider Company"
└── timezone: "UTC"
    │
    └─→ apps (Meta Apps)
        ├── id: "promotion-app"
        ├── business_id: "123456789" (FK to business_accounts)
        ├── name: "Promotion App"
        ├── verify_token: "my_token"
        └── access_token: "EAAN8Ny..."
            │
            └─→ phone_numbers (WhatsApp Phone Numbers)
                ├── phone_number_id: "542491768952983" (from Meta)
                ├── app_id: "promotion-app" (FK to apps)
                ├── phone_number: "+1234567890"
                └── display_name: "Main Line"
                    │
                    └─→ phone_number_projects (Junction Table)
                        ├── phone_number_id: "542491768952983"
                        ├── project_id: 1
                        ├── priority: 100
                        └── is_active: true
                            │
                            └─→ projects (Your Backend Services)
                                ├── id: 1
                                ├── name: "WA Promotion Service"
                                ├── endpoint: "https://wapromoapi.finglider.com/webhook"
                                └── is_active: true
```

## Complete Example

### Meta Setup

You have:

- **WABA ID**: `123456789` (from Meta)
- **App Name**: "My WhatsApp App" (in Meta)
- **App Access Token**: `EAAN8Ny1skzkBO...` (from Meta)
- **Phone Number ID**: `542491768952983` (from Meta)
- **Actual Phone**: `+1-234-567-8900`

### Database Setup

#### 1. Create Business Account (One-Time)

```sql
INSERT INTO business_accounts
(business_id, name, timezone)
VALUES
('123456789', 'FinGlider Company', 'UTC');
```

**Via API:**

```bash
curl -X POST http://localhost:3138/admin/business-accounts \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "123456789",
    "name": "FinGlinder Company"
  }'
```

#### 2. Create App (With Tokens)

```sql
INSERT INTO apps
(id, business_id, name, verify_token, access_token)
VALUES
('promo-app', '123456789', 'Promotion App', 'my_token', 'EAAN8Ny1skzkBO...');
```

**Via API:**

```bash
curl -X POST http://localhost:3138/admin/apps \
  -H "Content-Type: application/json" \
  -d '{
    "id": "promo-app",
    "business_id": "123456789",
    "name": "Promotion App",
    "verify_token": "my_secure_token",
    "access_token": "EAAN8Ny1skzkBO..."
  }'
```

#### 3. Add Phone Number

```sql
INSERT INTO phone_numbers
(phone_number_id, app_id, phone_number, display_name)
VALUES
('542491768952983', 'promo-app', '+1234567890', 'Main Line');
```

**Via API:**

```bash
curl -X POST http://localhost:3138/admin/phone-numbers \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number_id": "542491768952983",
    "app_id": "promo-app",
    "phone_number": "+1234567890",
    "display_name": "Main Business Line"
  }'
```

#### 4. Create Project (Your Backend)

```sql
INSERT INTO projects
(name, endpoint, description)
VALUES
('Promotion Service', 'https://myapi.com/webhook', 'Handles promos');
-- Returns project id: 1
```

**Via API:**

```bash
curl -X POST http://localhost:3138/admin/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Promotion Service",
    "endpoint": "https://myapi.com/webhook"
  }'
# Response: {"id": 1, "name": "Promotion Service", ...}
```

#### 5. Map Phone to Project

```sql
INSERT INTO phone_number_projects
(phone_number_id, project_id, priority)
VALUES
('542491768952983', 1, 100);
```

**Via API:**

```bash
curl -X POST http://localhost:3138/admin/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number_id": "542491768952983",
    "project_id": 1,
    "priority": 100
  }'
```

## How Messages Flow

```
1. Customer sends WhatsApp message to: +1-234-567-8900

2. Meta receives message, identifies phone_number_id: 542491768952983

3. Meta sends webhook to: https://yourdomain.com/meta/webhook
   Payload includes: phone_number_id = "542491768952983"

4. WhatsApp Hub receives webhook

5. Hub queries database:
   "Which projects are mapped to phone_number_id 542491768952983?"

6. Database returns:
   {
     phoneNumberId: "542491768952983",
     appId: "promo-app",
     accessToken: "EAAN8Ny1skzkBO...",
     businessId: "123456789",
     projectId: 1,
     projectName: "Promotion Service",
     endpoint: "https://myapi.com/webhook"
   }

7. Hub forwards webhook to: https://myapi.com/webhook
   (Includes all the above info)

8. Your backend receives webhook and can:
   - Process the message
   - Use accessToken to reply via Meta API
   - Use businessId for any Meta API calls
```

## Key Takeaways

✅ **`business_id`** = WABA ID from Meta (use actual WABA ID)  
✅ **`app.id`** = Your custom app identifier (can be anything)  
✅ **`phone_number_id`** = From Meta (unique ID for each phone)  
✅ **`project.id`** = Auto-generated (your backend services)

✅ **One business account** can have **multiple apps**  
✅ **One app** can have **multiple phone numbers**  
✅ **One phone number** can forward to **multiple projects**  
✅ **Each app** has its own **access_token** and **verify_token**

This design gives you maximum flexibility while keeping everything organized!
