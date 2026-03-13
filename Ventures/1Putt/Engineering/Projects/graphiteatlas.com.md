Focus: Yes
Preview Environment: dev.graphiteatlas.com
Project Hub: Graphite Atlas (https://www.notion.so/Graphite-Atlas-1eff3cf2487f80419b7adcb440906ac9?pvs=21) 
Stack: NextJS, Postgres, mcp, memgraph, radix, reSend, shadcn, tanstack, xyflow, zustand
Type: Retainer

# Engineering Onboarding Guide

Welcome to **Graphite Atlas**! This guide will get you up and running quickly. 

## Tech Stack Overview

Atlas is a **Next.js 15 full-stack application** with modern tooling:

### Frontend

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) - Simple, fast state stores
- **UI Components**: [Shadcn/ui](https://ui.shadcn.com/) - Built on Radix UI primitives
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS
- **Graph Visualization**: [ReactFlow](https://reactflow.dev/) - Interactive node graphs
- **Icons**: [Lucide React](https://lucide.dev/) - Beautiful icon set
- **Forms**: [Tanstack Form](https://tanstack.com/form) + Zod validation
- **Tables**: [Tanstack Table](https://tanstack.com/table) - Headless table library

### Backend

- **Runtime**: Next.js API Routes (App Router)
- **Database (Relational)**: [Neon Postgres](https://neon.tech/) - Serverless Postgres
- **Database (Graph)**: [Memgraph](https://memgraph.com/) - Graph database
- **ORM**: [Prisma](https://prisma.io/) - Type-safe database client
- **Authentication**: [NextAuth v5](https://authjs.dev/) - Email magic links (Resend)
- **AI SDK**: [Vercel AI SDK](https://sdk.vercel.ai/) + OpenAI GPT-4o

### Infrastructure

- **Hosting**: [Vercel](https://vercel.com/) - Frontend + API routes
- **Databases**: Neon (Postgres), Memgraph (Graph)
- **Email**: [Resend](https://resend.com/) - Transactional email
- **Analytics**: [PostHog](https://posthog.com/) + [Fathom](https://usefathom.com/)

### Development Tools

- **AI Assistant**: [Claude Code](https://claude.ai/code) - AI pair programmer
- **TypeScript**: Full type safety across the stack
- **ESLint**: Code linting (enforced via Husky)
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks (auto-runs ESLint + TypeScript)
- **Playwright**: E2E testing


## Development Workflow

### Git Workflow

**IMPORTANT**: You handle ALL git operations. Claude Code NEVER touches git.

```bash
# Before starting work
git pull origin dev

# Create feature branch
git checkout -b feature/your-feature-name

# After making changes
git add .
git commit -m "feat: your descriptive message"
# Husky runs automatically: ESLint + TypeScript checks

# Push to remote
git push origin feature/your-feature-name

# Create PR on GitHub
```

### Changelog Updates (REQUIRED)

**CRITICAL**: Always update `CHANGELOG.md` when committing new code.

```bash
# Before committing, add entry to CHANGELOG.md
# Follow Keep a Changelog format:
# - Added: New features
# - Changed: Changes to existing functionality
# - Fixed: Bug fixes
# - Removed: Removed features

# Example entry:
## [In Beta]
### Feature Name (YYYY-MM-DD)
#### Added
- New feature description
- File changes: `src/components/MyComponent.tsx`
```

**Why this matters**:
- Provides clear project history
- Makes code reviews easier
- Documents breaking changes
- Helps with release notes

### Pre-Commit Automation (Husky)

Pre-commit hooks run automatically on every commit:

```bash
# Auto-runs on git commit:
✓ ESLint on staged .ts/.tsx/.js/.jsx files (auto-fix enabled)
✓ TypeScript type checking on staged src/**/*.{ts,tsx} files

# Blocks commit if checks fail
# Bypass ONLY in emergencies:
git commit --no-verify  # NOT RECOMMENDED
```

### Before Pushing Code

**CRITICAL**: Always run a production build before pushing:

```bash
# Frontend build check (REQUIRED)
npm run build

# Must succeed without errors
# Catches:
# - TypeScript errors
# - React JSX issues (use &apos; for ', &quot; for ")
# - Import errors
# - Build-time failures
```

## Tools & Resources

---

### Claude Code

We use Claude Code for AI-assisted development:

- **Auto-runs on commit**: ESLint + TypeScript (via Husky)
- **Read CLAUDE.md**: Critical rules and guidelines
- **Never runs**: `git` commands unless you ask it to break the rules, `npm run dev`

### Neon Postgres

Access database:

```bash
# Use Neon CLI
npm install -g neonctl
neonctl branches list
neonctl sql-editor

# Or use Prisma Studio
npx prisma studio
```

### Documentation

- **Next.js**: https://nextjs.org/docs
- **Prisma**: https://prisma.io/docs
- **Shadcn/ui**: https://ui.shadcn.com
- **Tailwind**: https://tailwindcss.com/docs
- **ReactFlow**: https://reactflow.dev/learn

## Working with Data

### Prisma (Postgres)

```tsx
import { prisma } from '@/lib/prisma';

// Create
const atlas = await prisma.atlas.create({
  data: {
    id: 'unique-id',
    userId: session.user.id,
    name: 'My Atlas',
    description: 'Atlas description',
  },
});

// Read with relations
const atlases = await prisma.atlas.findMany({
  where: { userId: session.user.id },
  include: { views: true },
  orderBy: { createdAt: 'desc' },
});

// Update
await prisma.atlas.update({
  where: { id: atlasId },
  data: { name: 'Updated Name' },
});

// Delete
await prisma.atlas.delete({
  where: { id: atlasId },
});
```

### Memgraph (Graph Database)

```tsx
import { getGraphDriver } from '@/services/graph/driver';

const driver = getGraphDriver();
const session = driver.session();

try {
  const result = await session.run(
    `MATCH (a:Atlas {id: $atlasId})-[:CONTAINS]->(p:Point)
     RETURN p
     ORDER BY p.name`,
    { atlasId }
  );

  const points = result.records.map((record) => {
    const node = record.get('p');
    return {
      id: node.identity.toString(),
      ...node.properties,
    };
  });

  return points;
} finally {
  await session.close();
}
```

### Schema Migrations

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Generate Prisma client (after schema changes)
npx prisma generate

# View database in browser
npx prisma studio
```

## Common Tasks

---

### Add a New UI Component

```bash
# Use Shadcn CLI
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add select

# Components added to src/components/ui/
```

### Add a New API Endpoint

1. Create file: `src/app/api/your-route/route.ts`
2. Export `GET`, `POST`, `PUT`, `DELETE` functions
3. Use `auth()` for authentication
4. Return `NextResponse.json()`

### Add a New Zustand Store

File: `src/store/myStore.ts`

```tsx
import { create } from 'zustand';

interface MyStore {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useMyStore = create<MyStore>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
```

### Update Database Schema

```bash
# 1. Edit prisma/schema.prisma
# 2. Create migration
npx prisma migrate dev --name add_new_field

# 3. Generate Prisma client
npx prisma generate

# 4. Update TypeScript types if needed
```


🎨

## UI Development

### Shadcn/ui Components

All UI components use Shadcn (built on Radix UI):

```tsx
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function MyComponent() {
  return (
    <Dialog>
      <DialogContent>
        <DialogTitle>Create Atlas</DialogTitle>
        <Input placeholder="Atlas name" />
        <Button>Create</Button>
      </DialogContent>
    </Dialog>
  );
}
```

**Available Components** (in `src/components/ui/`):
- `button`, `dialog`, `input`, `select`, `checkbox`, `radio-group`
- `dropdown-menu`, `popover`, `tooltip`, `toast` (sonner)
- `table`, `accordion`, `tabs`, `scroll-area`
- `avatar`, `badge`, `card`, `separator`, `progress`

### Tailwind CSS

```tsx
import { cn } from '@/lib/utils';

// Conditional classes
<div className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'primary' && 'primary-class'
)} />

// Common patterns
<div className="flex items-center gap-2 p-4 rounded-lg bg-slate-100 dark:bg-slate-800" />
```

### Dark Mode Support

Always support both light and dark modes:

```tsx
// Tailwind dark mode classes
<div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />

// Access theme in components
import { useTheme } from '@/contexts/ThemeContext';

const { theme, setTheme } = useTheme();
// theme: 'light' | 'dark' | 'system'
```

### Icons (Lucide React)

```tsx
import { Plus, Trash2, ArrowRight, CheckCircle } from 'lucide-react';

<Button>
  <Plus className="h-4 w-4 mr-2" />
  Add Item
</Button>
```

## API Development

### Creating API Routes

File: `src/app/api/your-endpoint/route.ts`

```tsx
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/your-endpoint
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // 3. Query database
    const data = await prisma.atlas.findMany({
      where: { userId: session.user.id },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // 4. Return response
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/your-endpoint
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const { name, description } = body;

    // Validate
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Create
    const atlas = await prisma.atlas.create({
      data: {
        id: crypto.randomUUID(),
        userId: session.user.id,
        name,
        description: description || '',
      },
    });

    return NextResponse.json({ success: true, data: atlas }, { status: 201 });
  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Dynamic Routes

File: `src/app/api/atlases/[atlasId]/route.ts`

```tsx
interface RouteContext {
  params: Promise<{ atlasId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { atlasId } = await context.params;

  const atlas = await prisma.atlas.findUnique({
    where: { id: atlasId },
  });

  if (!atlas) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: atlas });
}
```

### API Client (Frontend)

Call APIs from frontend using `src/lib/api.ts`:

```tsx
import { apiClient } from '@/lib/api';

// GET request
const atlases = await apiClient.get('/api/atlases');

// POST request
const newAtlas = await apiClient.post('/api/atlases', {
  name: 'My Atlas',
  description: 'Description',
});

// PUT request
await apiClient.put(`/api/atlases/${id}`, { name: 'Updated' });

// DELETE request
await apiClient.delete(`/api/atlases/${id}`);
```
## Checklist: Your First Day

---

- [ ]  Clone repo and run `npm install`
- [ ]  Get environment variables from team
- [ ]  Run `npm run dev` and access http://localhost:3000
- [ ]  Explore the codebase structure
- [ ]  Read `CLAUDE.md` for critical rules
- [ ]  Create a test atlas in the UI
- [ ]  Make a small UI change to validate your workflow
- [ ]  Run `npm run build` to verify it builds
- [ ]  Create your first git branch and commit
- [ ]  Ask questions in slack
## Quick Start

### Prerequisites

- Node.js 20+ (we use 20.19.1)
- npm (comes with Node.js)
- Git
- Claude Code (optional but recommended)

### Setup

```bash
# Clone the repository (user will provide URL)
cd atlas

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials (ask team for values)

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev
# Access at http://localhost:3000
```

### Environment Variables You Need

Request these from your team lead:

- `DATABASE_URL_PREVIEW` - Neon Postgres dev database (pooled connection)
- `GRAPH_URI` - Memgraph connection string
- `NEXTAUTH_SECRET` - Auth secret (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - `http://localhost:3000` for local dev
- `RESEND_API_KEY` - Email service for magic links
- `OPENAI_API_KEY` - For AI features (if testing LLM)
## Getting Help

---

- MemGraph: Please create an issue: https://github.com/graphiteatlas/graph/issues.
- **Team Chat**: Team Slack
- **Claude Code**: [Claude Code Best Practices](Claude%20Code%20Best%20Practices.md)
## Project Structure

```
atlas/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes (73+ endpoints)
│   │   │   ├── atlases/        # Atlas CRUD
│   │   │   ├── auth/           # NextAuth handlers
│   │   │   ├── graph/          # Graph operations
│   │   │   └── ...
│   │   ├── workspace/          # Main application UI
│   │   ├── layout.tsx          # Root layout (providers, theme)
│   │   └── page.tsx            # Landing page
│   │
│   ├── components/             # React components
│   │   ├── ui/                 # Shadcn primitives (Button, Dialog, etc.)
│   │   ├── graph/              # ReactFlow graph components
│   │   ├── table/              # TanStack Table components
│   │   ├── layout/             # Header, Sidebar, etc.
│   │   └── ...
│   │
│   ├── lib/                    # Utilities & services
│   │   ├── api.ts              # API client functions
│   │   ├── prisma.ts           # Prisma singleton
│   │   ├── eventBus.ts         # Event system
│   │   └── ...
│   │
│   ├── store/                  # Zustand stores
│   │   ├── atlasStore.ts       # Current atlas state
│   │   ├── graphStore.ts       # Graph data & operations
│   │   ├── viewStore.ts        # View management
│   │   └── ...
│   │
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # TypeScript types
│   ├── utils/                  # Helper functions
│   └── styles/                 # Global styles
│
├── prisma/
│   └── schema.prisma           # Database schema
│
├── e2e/                        # Playwright E2E tests
├── scripts/                    # Utility scripts
├── public/                     # Static assets
│
├── .env.local                  # Local environment variables
├── .env.example                # Example env vars
├── next.config.ts              # Next.js configuration
├── tailwind.config.js          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies & scripts
└── CLAUDE.md                   # Claude Code instructions
```

## Key Architectural Concepts

### 1. Labeled Property Graph (LPG)

Atlas uses **Memgraph**, a **Labeled Property Graph** database with powerful capabilities:

**What is LPG?**
- Nodes (Points) and relationships (Paths) can have **labels** (types)
- Both can have **properties** (key-value pairs)
- Rich metadata attached directly to graph elements

**Example Structure**:

```
// Node with label and properties
(p:Person:Employee {
  name: "John Doe",
  email: "john@example.com",
  department: "Engineering"
})

// Relationship with label and properties
(p)-[:MANAGES {since: "2024-01-01", level: "senior"}]->(team)
```

**Why LPG is Powerful for LLM Interactions**:
- **Semantic richness**: Labels provide type context for AI reasoning
- **Property-based querying**: Filter by metadata without scanning all nodes
- **Contextual retrieval**: Properties help LLMs understand entity characteristics
- **Relationship semantics**: Edge labels convey meaning (not just connections)
- **Natural language mapping**: Graph structure mirrors how humans describe relationships

**MAGE - Memgraph Advanced Graph Extensions**:
- **Graph algorithms library** built into Memgraph
- Pre-built algorithms for common graph operations
- Community detection, centrality measures, pathfinding
- Available via Cypher queries

**Common MAGE Algorithms**:

```
// PageRank - find most important nodes
CALL pagerank.get() YIELD node, rank
RETURN node.name, rank
ORDER BY rank DESC;

// Community detection - find clusters
CALL community_detection.get() YIELD node, community_id
RETURN community_id, collect(node.name);

// Shortest path - find connections
MATCH path = shortestPath(
  (start:Point {id: $startId})-[*]-(end:Point {id: $endId})
)
RETURN path;
```

### 2. Two-Layer Metagraph

Atlas uses a **schema layer** + **data layer** architecture:

```
Schema Layer (Ontology)
  ↓ "is a" relationships
Data Layer (Instances)
```

- **Points** = Nodes (entities like “PostgreSQL”, “John Doe”)
- **Paths** = Edges (relationships like “uses”, “manages”)
- **Types** = Schema definitions (like “Database”, “Person”)

### 3. Database Architecture

**Neon Postgres** (Primary):
- User accounts, sessions (NextAuth)
- Atlas metadata (name, description, schema)
- Views and view hierarchies
- Feature flags, API keys
- Uses **pooled connections** for serverless

**Memgraph** (Graph):
- All Points (nodes) and Paths (edges)
- Connected to atlases via `CONTAINS` relationships
- Neo4j Bolt protocol compatible (uses `neo4j-driver`)

### 4. Authentication Flow

NextAuth with email magic links (Resend):

```
1. User enters email → POST /api/auth/signin/email
2. NextAuth sends magic link via Resend
3. User clicks link → Callback handler
4. Session created in Postgres
5. JWT token in cookie
```

Access session in components:

```tsx
import { auth } from '@/auth';

// Server Component
const session = await auth();

// Client Component
import { useSession } from '@/components/auth/SessionProvider';
const { data: session } = useSession();
```

### 5. View System & Sidebar Architecture

The view system is a powerful feature for organizing and filtering graph data:

**View Types**:
- **Map** (Graph): Interactive node-edge visualization using ReactFlow
- **Table**: Tabular data with sorting, filtering, pagination
- **Combo**: Split view with graph on left, table on right
- **Folder**: Container for organizing views hierarchically

**Sidebar Navigation** (`QueryBasedSidebar.tsx`):
- **Hierarchical tree structure**: Views can be nested in folders
- **Drag-and-drop**: Reorganize views by dragging
- **Inline editing**: Double-click view name to rename
- **Collapsible sections**: Expand/collapse atlases and folders
- **Persistent state**: Remembers expanded states and sidebar width

**Show/Hide Points & Paths**:
- **Per-view visibility**: Each view can show/hide specific points and paths
- **Visibility controls**:
- Graph toolbar: Toggle visibility for selected items
- Context menu: Right-click to hide/show
- Filters panel: Bulk show/hide by type or property
- **Visibility storage**: Saved in `View.visibility` JSON field
- **Cross-view independence**: Hiding in one view doesn’t affect others

**How It All Ties Together**:

```
User clicks view in sidebar
  ↓
ViewContainer loads view from Postgres
  ↓
Fetches Points/Paths from Memgraph (filtered by atlasId)
  ↓
Applies view-specific visibility filters
  ↓
Renders in GraphView or TableView
  ↓
User changes visibility (hide/show points)
  ↓
Updates View.visibility in Postgres
  ↓
Graph re-renders with new visibility
```

**Example Visibility Structure**:

```json
{
  "hiddenPoints": ["point-id-1", "point-id-2"],
  "hiddenPaths": ["path-id-1"],
  "visibleOnly": false
}
```

### 6. Global Points Architecture

Views are filters/perspectives on the same global data:

- **Types**: Map (graph), Table, Combo (split view), Folder
- **Hierarchy**: Views can be nested in folders
- **Preferences**: User-specific settings (node positions, column widths)
- **Persistence**: Settings stored in Postgres, sync via API
## Testing

### E2E Tests (Playwright)

```bash
# Run all tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific test
npm run test:e2e e2e/tests/atlas-crud.spec.ts

# Generate test report
npm run test:e2e:report
```

### Writing Tests

File: `e2e/tests/my-feature.spec.ts`

```tsx
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/workspace');

    // Click button
    await page.click('button:has-text("Create")');

    // Fill input
    await page.fill('input[name="name"]', 'Test Name');

    // Submit
    await page.click('button:has-text("Submit")');

    // Assert
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```
## Deployment

**Automatic deployment** via Vercel:

```bash
# Development (auto-deploys on push to dev)
git push origin dev
# → Deploys to dev.graphiteatlas.com

# Production (auto-deploys on push to main)
git push origin main
# → Deploys to graphiteatlas.com
```

**Most env variables are setup for multi environments except our neon integration is fully separate see below**:
- Production uses `DATABASE_URL_PROD`
- Preview/Dev uses `DATABASE_URL_PREVIEW`

**NEVER deploy manually** - always use git push.

### Troubleshooting

---

### Build Fails with TypeScript Errors

```bash
# Run type check
npm run typecheck

# Common fixes:
# - Add missing imports
# - Fix type definitions
# - Use 'any' as last resort (but avoid!)
```

### Build Fails with React JSX Errors

```bash
# Error: "&#39;" in JSX
# Fix: Use &apos; instead of ' in JSX strings

# Before
<p>Don't do this</p>

# After
<p>Don&apos;t do this</p>
```

### Prisma Client Not Generated

```bash
# Regenerate
npx prisma generate

# If still broken
rm -rf node_modules/.prisma
npm install
npx prisma generate
```

### Database Connection Issues

```bash
# Check environment variables
echo $DATABASE_URL_PREVIEW
echo $DATABASE_URL_PROD

# Test connection
npx prisma db pull
```

### Husky Pre-commit Hook Fails

```bash
# Fix linting errors
npm run lint:fix

# Fix TypeScript errors
npm run typecheck

# Force commit (NOT RECOMMENDED)
git commit --no-verify
```

### Dev Server Won’t Start

```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Restart
npm run dev
```

### Theme System Issues (Claude Code Confusion)

**Problem**: Claude Code sometimes gets confused about the theme system implementation.

**Symptoms**:
- Theme not persisting across page reloads
- Flash of unstyled content (FOUC) on page load
- Dark mode classes not applying correctly

**Root Cause**: Theme initialization happens in TWO places:
1. **Inline script in `layout.tsx`** (prevents FOUC, runs before React hydration)
2. **ThemeProvider component** (manages theme state after hydration)

**Key Implementation Details**:

```tsx
// src/app/layout.tsx (lines 116-133)
// Inline script reads localStorage BEFORE React renders
<script dangerouslySetInnerHTML={{
  __html: `
    const theme = localStorage.getItem('graphite-atlas-theme') || 'system';
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemTheme) root.classList.add('dark');
    }
  `,
}} />

// src/contexts/ThemeContext.tsx
// Provider syncs with localStorage and manages state
const [theme, setTheme] = useState<Theme>(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('graphite-atlas-theme') as Theme || 'system';
  }
  return 'system';
});
```

**What NOT to do**:
- ❌ Remove the inline script (causes FOUC)
- ❌ Only use ThemeProvider (theme won’t apply before hydration)
- ❌ Change localStorage key (breaks persistence)
- ❌ Remove `suppressHydrationWarning` from `<html>` tag

**Correct Pattern**:
- ✅ Keep both inline script AND ThemeProvider
- ✅ Use `graphite-atlas-theme` as localStorage key
- ✅ Apply `dark` class to `<html>` element
- ✅ Keep `suppressHydrationWarning` to prevent React mismatch errors

**If Claude Code suggests changing theme system**:
1. Check if it’s trying to remove the inline script → Reject
2. Check if it’s changing the localStorage key → Reject
3. Check if it’s removing ThemeProvider → Reject
4. The current implementation is correct and battle-tested

## Where to Go Next →
---
https://github.com/graphiteatlas/atlas/issues: The atlas codebase is in the iterative phase, fixing bugs and enhancing the capabilities of the product.  This is a good place to put in work.  Feature branch off dev, make a PR, attach the github issue to the PR,  we will PR back into dev. This will deploy to [dev.graphiteatlas.com](http://dev.graphiteatlas.com) using Vercel. Once your changes pass some testing, update the changelog and the issue in github. 
