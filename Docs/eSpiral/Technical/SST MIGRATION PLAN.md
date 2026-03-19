# SST MIGRATION PLAN

## Executive Summary

**Goal**: Migrate from AWS Architect to SST using ECS/Fargate containers with AWS ECR base images.

**Timeline**: 7-8 hours total work
- **Day 1 (Today)**: 4-5 hours - Setup, configuration, data layer refactor
- **Day 2 (Tomorrow)**: 2-3 hours - CI/CD updates, deployment to staging

**Why SST Container Deployment?**
- ✅ Eliminates all build script complexity (no more build-lambda.js issues)
- ✅ No Lambda cold starts - long-lived containers
- ✅ Better performance for DynamoDB access (same region)
- ✅ Simpler deployment - single command
- ✅ AWS ECR base images for better AWS integration
- ✅ Type-safe infrastructure as code
- ✅ Modern tooling (Pulumi/Terraform vs CloudFormation)

---

## Current Architect Setup Analysis

### What We’re Using Now

**Infrastructure (from app.arc):**
- 8 DynamoDB tables with encryption
- 2 Global Secondary Indexes
- Lambda function (3GB memory, 60s timeout, Node.js 20)
- S3 for static assets
- CloudFront CDN
- API Gateway HTTP endpoint

**DynamoDB Tables:**
1. `user` - pk: String
2. `password` - pk: String, encrypted
3. `resetToken` - pk: String, encrypted
4. `card` - pk: String, encrypted
5. `advisory` - pk: String, encrypted
6. `connections` - pk: String
7. `chart` - pk: String, sk: String, encrypted (GSI: byUser)
8. `hospital` - pk: String, encrypted
9. `environment` - pk: String, sk: String, encrypted (GSI: byHospital)

**Data Access Pattern:**
- Uses `@architect/functions` library
- Pattern: `const db = await arc.tables()` then `db.tableName.query()`
- Used in 13 files across models, services, and scripts

**Build System:**
- Custom `scripts/build-lambda.js` to create Lambda handler
- Remix builds via Vite
- Complex path detection logic for CI vs local
- Server directory creation and file copying

**Environment Variables:**
- DEEPGRAM_API_KEY
- DEEPGRAM_API_IDENTIFIER
- OPENAI_API_KEY
- REDIRECT_URI (staging vs production)
- EPIC_CLIENT_ID
- SESSION_SECRET
- ADMIN_PASSWORD

---

## Migration Plan - Detailed Steps

### Phase 1: SST Installation & Configuration (1.5 hours)

### Step 1.1: Install SST (5 min)

```bash
cd /Users/cj/ComSci/Workspace/practice_rounds/app
npx sst@latest init
```

**Interactive prompts:**
- Provider: Select “AWS”
- This creates `sst.config.ts` at project root

### Step 1.2: Create Complete sst.config.ts (45 min)

**File to create:** `sst.config.ts`

### Step 1.3: Create Dockerfile with AWS ECR Base Image (15 min)

**File to create:** `Dockerfile`

### Step 1.4: Set Up SST Secrets (15 min)

---

### Phase 2: Create DynamoDB Abstraction Layer (30 min)

### Step 2.1: Create DynamoDB Helper (30 min)

**File to create:** `app/lib/dynamodb.server.ts`

```tsx
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";import {
  DynamoDBDocumentClient,  QueryCommand,  PutCommand,  DeleteCommand,  GetCommand,  UpdateCommand,  ScanCommand,} from "@aws-sdk/lib-dynamodb";import { Resource } from "sst";// Initialize DynamoDB Document Clientconst client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,  },});// Table name mappingconst TABLE_MAP: Record<string, string> = {
  user: Resource.UserTable.name,  password: Resource.PasswordTable.name,  resetToken: Resource.ResetTokenTable.name,  card: Resource.CardTable.name,  advisory: Resource.AdvisoryTable.name,  connections: Resource.ConnectionsTable.name,  chart: Resource.ChartTable.name,  hospital: Resource.HospitalTable.name,  environment: Resource.EnvironmentTable.name,};// Helper functions matching Architect patternsexport const dynamodb = {
  /**   * Query items from a table   * @param tableName - Logical table name (e.g., 'user')   * @param params - DynamoDB query parameters   */  query: async (tableName: string, params: any) => {
    const TableName = TABLE_MAP[tableName];    if (!TableName) {
      throw new Error(`Unknown table: ${tableName}`);    }
    const result = await client.send(
      new QueryCommand({
        TableName,        ...params,      })
    );    return result;  },  /**   * Get a single item   * @param tableName - Logical table name   * @param key - Item key   */  get: async (tableName: string, key: any) => {
    const TableName = TABLE_MAP[tableName];    if (!TableName) {
      throw new Error(`Unknown table: ${tableName}`);    }
    const result = await client.send(
      new GetCommand({
        TableName,        Key: key,      })
    );    return result.Item;  },  /**   * Put an item in a table   * @param tableName - Logical table name   * @param item - Item to insert/update   */  put: async (tableName: string, item: any) => {
    const TableName = TABLE_MAP[tableName];    if (!TableName) {
      throw new Error(`Unknown table: ${tableName}`);    }
    await client.send(
      new PutCommand({
        TableName,        Item: item,      })
    );  },  /**   * Delete an item   * @param tableName - Logical table name   * @param key - Item key to delete   */  delete: async (tableName: string, key: any) => {
    const TableName = TABLE_MAP[tableName];    if (!TableName) {
      throw new Error(`Unknown table: ${tableName}`);    }
    await client.send(
      new DeleteCommand({
        TableName,        Key: key,      })
    );  },  /**   * Update an item   * @param tableName - Logical table name   * @param params - Update parameters   */  update: async (tableName: string, params: any) => {
    const TableName = TABLE_MAP[tableName];    if (!TableName) {
      throw new Error(`Unknown table: ${tableName}`);    }
    const result = await client.send(
      new UpdateCommand({
        TableName,        ...params,      })
    );    return result;  },  /**   * Scan a table   * @param tableName - Logical table name   * @param params - Scan parameters   */  scan: async (tableName: string, params: any = {}) => {
    const TableName = TABLE_MAP[tableName];    if (!TableName) {
      throw new Error(`Unknown table: ${tableName}`);    }
    const result = await client.send(
      new ScanCommand({
        TableName,        ...params,      })
    );    return result;  },};// Export direct client for advanced use casesexport { client as dynamoClient };
```

---

### Phase 3: Update Data Access Layer (2-3 hours)

### Files That Need to Be Updated (13 total)

**Pattern to follow for each file:**

```tsx
// OLD (Architect)
import arc from "@architect/functions";

export async function getUserById(id: string) {
  const db = await arc.tables();  const result = await db.user.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": id },  
  });  
  return result.Items[0];
}

// NEW (SST)
import { dynamodb } from "~/lib/dynamodb.server";

export async function getUserById(id: string) {
  const result = await dynamodb.query("user", {
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": id },  
  });  
  return result.Items?.[0] || null;
}
```

### Step 3.1: Update Model Files (1.5 hours)

**File:** `app/models/user.server.ts`
- Replace: `import arc from "@architect/functions"`
- Add: `import { dynamodb } from "~/lib/dynamodb.server"`
- Update: `arc.tables()` → `dynamodb.query("user", ...)`
- Update: `db.user.put()` → `dynamodb.put("user", ...)`
- Update: `db.user.delete()` → `dynamodb.delete("user", ...)`

**File:** `app/models/card.server.ts`
- Same pattern as user.server.ts
- Table name: “card”

**File:** `app/models/chart.server.ts`
- Same pattern as user.server.ts
- Table name: “chart”
- Note: Uses GSI “byUser”

**File:** `app/models/advisory.server.ts`
- Same pattern as user.server.ts
- Table name: “advisory”

**File:** `app/models/hospital.server.ts`
- Same pattern as user.server.ts
- Table name: “hospital”

**File:** `app/models/environment.server.ts`
- Same pattern as user.server.ts
- Table name: “environment”
- Note: Uses GSI “byHospital”

### Step 3.2: Update Service Files (30 min)

**File:** `app/services/audit.server.ts`
- Replace Architect imports
- Update table access patterns

**File:** `app/services/phi/retention.server.ts`
- Replace Architect imports
- Update table access patterns

### Step 3.3: Update Script Files (45 min)

**File:** `scripts/create-admin.ts`
- Replace: `import arc from "@architect/functions"`
- Add: `import { dynamodb } from "../app/lib/dynamodb.server"`
- Update table access

**File:** `scripts/check-admin-user.ts`
- Same pattern

**File:** `scripts/setup-staging-admin.ts`
- Same pattern

**File:** `scripts/seed-epic-environment.ts`
- Same pattern

### Step 3.4: Update Test Files (15 min)

**File:** `tests/e2e/fixtures/admin-setup.ts`
- Replace Architect imports
- Update table access

---

### Phase 4: Remove Architect Files & Dependencies (30 min)

### Step 4.1: Delete Files

**Files to DELETE:**

```
app.arc                          # Architect configuration
.arcignore                       # Architect ignore file
scripts/build-lambda.js          # Custom Lambda builder
server/                          # Generated server directory (if exists)
remix.config.js                  # Old Remix config (if exists)
```

**Commands:**

```bash
rm -f app.arc
rm -f .arcignore
rm -f scripts/build-lambda.js
rm -rf server/
rm -f remix.config.js
```

### Step 4.2: Update package.json

**Remove dependencies:**

```bash
npm uninstall @architect/functions @architect/architect
```

**Add SST:**

```bash
npm install --save-dev sst
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

**Update scripts in package.json:**

```json
{  
	"scripts": {    
		"build": "remix vite:build",    
		"dev": "remix vite:dev",    
		"start": "remix-serve ./build/server/index.js",    
		"typecheck": "tsc",    
		"lint": "eslint --cache --cache-location ./node_modules/.cache/eslint .",    
		"test": "vitest",    
		"deploy:staging": "sst deploy --stage staging",    
		"deploy:production": "sst deploy --stage production"  
	}
}
```

### Step 4.3: Simplify vite.config.js

**File:** `vite.config.js`

Remove any Architect-specific code, keep only Remix essentials:

```jsx
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [ remix({ ignoredRouteFiles: ["**/.*", "**/*.test.{js,jsx,ts,tsx}"] })],  ssr: {
  noExternal: ["d3", "mafs", "@paralleldrive/cuid2"]
});
```

### Step 4.4: Update .gitignore

**File:** `.gitignore`

Remove Architect-specific entries, add SST:

```
# Remove these (Architect-specific)
/buckets
preferences.arc
sam.json
sam.yaml

# Add these (SST-specific)
.sst/
.open-next/

# Keep these
node_modules
/build
.env
```

---

### Phase 5: Update CI/CD Workflow (45 min)

### Step 5.1: Update GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

### Phase 6: Testing & Deployment (1.5 hours)

### Step 6.1: Local Development Testing (30 min)

```bash
# Start SST dev mode
npx sst dev
# This will:
# 1. Deploy a dev stack to AWS
# 2. Run your Remix app locally
# 3. Connect to real AWS resources
# 4. Enable hot reload
```

**Verify:**
- App loads at http://localhost:5173
- Can query DynamoDB tables
- Environment variables are available
- Routes work correctly

### Step 6.2: Deploy to Staging (30 min)

```bash
# First deployment
npx sst deploy --stage staging
```

**SST will:**
1. Build Dockerfile using AWS ECR base image
2. Push image to Amazon ECR
3. Create/update VPC, ECS cluster, load balancer
4. Deploy to Fargate containers
5. Configure CloudFront distribution
6. Set up domain (staging.espiral.healthcare)

**Deployment Output:**

```
✓  Complete
   EspiralWeb: https://staging.espiral.healthcare
```

### Step 6.3: Verify Deployment (30 min)

```bash
# Check health endpoint
curl https://staging.espiral.healthcare/api/health
# Check if tables are accessible
# Test login flow
# Verify all features work
```

---

## File Modification Summary

### Files to CREATE (3)

- ✅ `sst.config.ts` - SST infrastructure configuration
- ✅ `Dockerfile` - Container image definition with AWS ECR base
- ✅ `app/lib/dynamodb.server.ts` - DynamoDB abstraction layer

### Files to UPDATE (15)

**Models (6):**
- ✅ `app/models/user.server.ts`
- ✅ `app/models/card.server.ts`
- ✅ `app/models/chart.server.ts`
- ✅ `app/models/advisory.server.ts`
- ✅ `app/models/hospital.server.ts`
- ✅ `app/models/environment.server.ts`

**Services (2):**
- ✅ `app/services/audit.server.ts`
- ✅ `app/services/phi/retention.server.ts`

**Scripts (4):**
- ✅ `scripts/create-admin.ts`
- ✅ `scripts/check-admin-user.ts`
- ✅ `scripts/setup-staging-admin.ts`
- ✅ `scripts/seed-epic-environment.ts`

**Tests (1):**
- ✅ `tests/e2e/fixtures/admin-setup.ts`

**Configuration (2):**
- ✅ `package.json` - Update scripts, remove Architect deps, add SST
- ✅ `.github/workflows/deploy.yml` - Replace with SST deployment

### Files to DELETE (5)

- ❌ `app.arc` - Architect configuration (replaced by sst.config.ts)
- ❌ `.arcignore` - Architect ignore file (not needed)
- ❌ `scripts/build-lambda.js` - Custom build script (SST handles this)
- ❌ `server/` directory - Generated files (SST manages this)
- ❌ `remix.config.js` - Old config (if exists, replaced by vite.config.js)

### Files to SIMPLIFY (2)

- 🔄 `vite.config.js` - Remove Architect-specific code
- 🔄 `.gitignore` - Remove Architect entries, add SST entries

---

## Verification Checklist

### Before Migration

- [ ]  All tests pass locally
- [ ]  Current staging is working
- [ ]  Have backup of DynamoDB tables
- [ ]  Have all environment variables documented

### After Migration - Staging

- [ ]  `npx sst dev` works locally
- [ ]  All routes load correctly
- [ ]  Login/authentication works
- [ ]  DynamoDB queries work
- [ ]  Health endpoint returns 200
- [ ]  FHIR integration works
- [ ]  WebSocket connections work (if applicable)
- [ ]  File uploads work
- [ ]  Admin functions work

### After Migration - Production

- [ ]  Staging has been stable for 24 hours
- [ ]  Load testing completed
- [ ]  Rollback plan documented
- [ ]  DNS records updated
- [ ]  Monitoring/alerts configured

---

## Rollback Plan

If issues occur:

1. **Immediate (< 5 min):** Revert DNS to old Architect deployment
2. **Short-term (< 30 min):** Revert git commits, redeploy Architect
3. **Data recovery:** DynamoDB tables are separate, no data loss

---

## Timeline Estimate

### Day 1 (Today) - 4-5 hours

- ✅ Phase 1: SST setup & config (1.5 hours)
- ✅ Phase 2: DynamoDB abstraction (30 min)
- ✅ Phase 3: Update data layer (2-3 hours)

### Day 2 (Tomorrow) - 2-3 hours

- ✅ Phase 4: Clean up Architect (30 min)
- ✅ Phase 5: Update CI/CD (45 min)
- ✅ Phase 6: Test & deploy (1.5 hours)

**Total: 7-8 hours**

---

## Post-Migration Benefits

1. **Simplified Build:** No custom build scripts, SST handles everything
2. **Better Performance:** Containers stay warm, no cold starts
3. **Type Safety:** SST resources are type-safe with TypeScript
4. **Modern IaC:** Pulumi/Terraform instead of CloudFormation
5. **Better DX:** `sst dev` for local development with live AWS access
6. **Single Command Deploy:** `sst deploy --stage staging`
7. **Multi-cloud Ready:** SST supports AWS, Cloudflare, and more
8. **Active Community:** SST is actively developed with regular updates

---

## Support Resources

- SST Docs: https://sst.dev/docs
- SST Discord: https://discord.gg/sst
- GitHub Issues: https://github.com/sst/sst

---

## Notes

- DynamoDB table data is preserved (tables are separate from infrastructure)
- Environment variables moved to SST Secrets (more secure)
- CloudFront CDN still used for static assets
- Same AWS region (us-east-1)
- Same Node.js version (20.x)
- Same Remix version
- Routes require NO changes

---

## Migration Progress Log

### Completed Tasks ✅

**Phase 1: SST Installation & Configuration** (Completed)
- ✅ Installed SST 3.17.14 via `npx sst@latest init`
- ✅ Created complete `sst.config.ts` with:
- 9 DynamoDB tables (all with encryption)
- 2 Global Secondary Indexes (byUser, byHospital)
- VPC with managed NAT gateway
- ECS Fargate cluster
- Container service (2 vCPU, 4GB memory)
- Environment-specific Epic Client IDs (production vs non-production)
- ✅ Created `Dockerfile` with AWS ECR base image (`public.ecr.aws/docker/library/node:20-alpine`)
- ✅ Set up all SST secrets for staging:
- DeepgramApiKey
- DeepgramApiIdentifier
- OpenAIApiKey
- SessionSecret
- AdminPassword
- EpicClientIdNonProduction (staging)
- EpicClientIdProduction (pre-configured)

**Phase 2: DynamoDB Abstraction Layer** (Completed)
- ✅ Created `app/lib/dynamodb.server.ts` with full DynamoDB Document Client wrapper
- ✅ Implemented `tables()` helper function for Architect compatibility
- ✅ Added query, get, put, delete, scan methods for all 9 tables
- ✅ Type-safe Resource linking via SST

**Phase 3: Update Data Access Layer** (Completed - 15 files)
- ✅ Updated 6 model files:
- `app/models/user.server.ts`
- `app/models/card.server.ts`
- `app/models/chart.server.ts`
- `app/models/advisory.server.ts`
- `app/models/hospital.server.ts`
- `app/models/environment.server.ts`
- ✅ Updated 2 service files:
- `app/services/audit.server.ts`
- `app/services/phi/retention.server.ts`
- ✅ Updated 1 route file:
- `app/routes/api.health.tsx`
- ✅ Updated 4 script files:
- `scripts/create-admin.ts`
- `scripts/check-admin-user.ts`
- `scripts/setup-staging-admin.ts`
- `scripts/seed-epic-environment.ts`
- ✅ Updated 1 test file:
- `tests/e2e/fixtures/admin-setup.ts`

**Phase 4: Remove Architect Files & Dependencies** (Completed)
- ✅ Deleted Architect files:
- `app.arc`
- `.arcignore`
- `prefs.arc`
- `server/` directory
- `src/` directory
- `scripts/build-lambda.js`
- `server.lambda.ts`
- ✅ Updated `package.json`:
- Removed: @architect/functions, @architect/architect, @remix-run/architect
- Added: @remix-run/express
- Moved to dependencies: @remix-run/node, @remix-run/react
- Updated scripts: `dev: "sst dev remix vite:dev"`, `build: "remix vite:build"`, `start: "node server.ts"`
- ✅ Created `server.ts` Express entry point for container deployment
- ✅ Updated `vite.config.js`:
- Removed serverModuleFormat config
- Removed Architect-specific publicPath/base configs
- Added `sst` to `ssr.noExternal` for Resource linking

**Phase 5: Update CI/CD Workflow** (Completed)
- ✅ Updated `.github/workflows/deploy.yml`:
- Replaced Architect build steps with SST deployment
- Simplified deployment to single `npx sst deploy` command
- Kept health checks and admin setup scripts
- Removed Lambda-specific build complexity

**Phase 6: Deployment** (In Progress)
- ✅ Installed dependencies: `npm ci`
- ✅ Fixed Docker daemon issue (started Docker Desktop)
- ✅ Fixed vite build error (added `sst` to `ssr.noExternal`)
- 🔄 Currently deploying to staging (background process 8a56f3)
- ⏳ Pending: Health check verification
- ⏳ Pending: Admin user setup
- ⏳ Pending: Full feature verification

### Issues Encountered & Resolutions

**Issue 1: Docker Daemon Not Running**
- Error: `Cannot connect to the Docker daemon`
- Resolution: Started Docker Desktop with `open -a Docker`

**Issue 2: Build Failed - SST Module Import**
- Error: `The module "sst" was incorrectly marked as external by Vite`
- Root Cause: SST’s Resource import needs to be bundled with server code
- Resolution: Added `sst` to `ssr.noExternal` in `vite.config.js:56`

**Issue 3: NAT Gateway EIP Already Associated**
- Error: `Elastic IP address is already associated`
- Root Cause: Failed deployment left resources in incomplete state
- Resolution: Full cleanup with `sst remove --stage staging` then fresh deploy

**Issue 4: Epic Client ID Split**
- Discovery: User has separate Epic Client IDs for production vs non-production
- Resolution: Updated `sst.config.ts` to use conditional secret selection:
`typescript   const epicClientId = new sst.Secret(     $app.stage === "production" ? "EpicClientIdProduction" : "EpicClientIdNonProduction"   );`

### Current Status

**Deployment in Progress** (Background process 8a56f3)
- Cleaning up failed infrastructure resources
- Will automatically deploy after 60 second wait
- Expected completion: 5-10 minutes
- Docker is running and healthy
- All code changes complete
- All secrets configured

### Next Steps

1. ⏳ Monitor deployment completion (check process 8a56f3)
2. ⏳ Verify staging health: `curl https://staging.espiral.healthcare/api/health`
3. ⏳ Run admin setup: `AWS_PROFILE=espiral npm run setup:staging-admin`
4. ⏳ Test all features:
    - Login/authentication
    - FHIR integration
    - Chart creation and viewing
    - Advisory builder
    - Hospital/environment management
    - Admin dashboard
5. ⏳ If staging stable, prepare production deployment

### Time Tracking

- Day 1: ~4.5 hours (Setup, configuration, code migration)
- Day 2: ~2 hours so far (Cleanup, CI/CD, deployment troubleshooting)
- **Total**: ~6.5 hours (under 7-8 hour estimate)

### Key Decisions Made

1. **Container over Lambda**: User preference for better performance and no cold starts
2. **AWS ECR Base Image**: User requirement for better AWS integration
3. **Express Server**: Replaced Lambda handler for container deployment
4. **Abstraction Layer**: Created `dynamodb.server.ts` to minimize code changes
5. **Environment-Specific Epic IDs**: Conditional secret selection based on stage
6. **Full Resource Cleanup**: Removed failed deployment before fresh deploy to avoid state conflicts