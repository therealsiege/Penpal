Focus: No
Preview Environment: dev.1putthealth.com
Project Hub: Home (https://www.notion.so/Home-209a9fbf7e494017b8336d1370a5e3a9?pvs=21) 
Stack: NextJS, radix, reSend, shadcn
Type: Marketing
## **Project Overview**

**1Putt Health LLC** is a healthcare technology consulting company website built with Next.js 15.5.6 and Radix UI. The site serves as a marketing platform showcasing services, case studies, and client testimonials, with an integrated lead generation and admin CRM system.

**Key Business Functions:**

- Marketing website for healthcare technology consulting services
- Lead capture and qualification system
- Admin dashboard for lead management
- Analytics tracking with Fathom Analytics

---

## **Tech Stack**

### **Core Framework**

- **Next.js 15.5.6** (App Router)
- **React 18.3.1**
- **Node.js** (specified in package.json)

### **UI & Styling**

- **Radix UI Themes** (^3.1.6) - Primary component library
- **Radix UI Icons** (^1.3.2)
- All pages use `'use client'` directive (Radix requirement)

### **Backend & Database**

- **Vercel Postgres** (Neon) - PostgreSQL database
- **NextAuth.js** (^4.24.13) - Authentication (magic link email)
- **Resend** (^6.5.2) - Transactional email service
- **Nodemailer** (^7.0.11) - Email sending

### **Testing & Analytics**

- **Playwright** (^1.57.0) - E2E testing
- **Fathom Analytics** - Privacy-focused analytics
- **ESLint** - Code linting

---

## **Architecture**

### **Directory Structure**

```
/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.jsx            # Homepage
│   │   ├── layout.jsx          # Root layout with Radix Theme
│   │   ├── contact/            # Contact form page
│   │   ├── about/              # About page
│   │   ├── services/           # Service pages
│   │   │   ├── compliance/
│   │   │   ├── interoperability/
│   │   │   ├── product-engineering/
│   │   │   ├── technical-strategy/
│   │   │   └── technical-due-diligence/
│   │   ├── work/               # Case studies
│   │   │   ├── lexmed/
│   │   │   ├── practice-rounds/
│   │   │   └── graphite-atlas/
│   │   ├── admin/              # Protected admin dashboard
│   │   │   ├── leads/
│   │   │   └── analytics/
│   │   ├── admin-auth/         # Auth pages
│   │   │   ├── login/
│   │   │   └── verify-request/
│   │   └── api/                # API routes
│   │       ├── contact/route.js
│   │       ├── newsletter/route.js
│   │       ├── auth/[...nextauth]/route.js
│   │       └── leads/
│   ├── components/             # React components
│   │   ├── RadixNavigation.jsx
│   │   ├── Footer.jsx
│   │   ├── ContactForm.jsx
│   │   ├── TestimonialCard.jsx
│   │   ├── LeadCaptureCTA.jsx
│   │   └── AdminNav.jsx
│   ├── contexts/               # React contexts
│   │   └── AdminEasterEggContext.jsx
│   ├── lib/                    # Utilities
│   │   ├── auth.js             # NextAuth config
│   │   ├── fathom.js           # Analytics tracking
│   │   └── metadata.js         # SEO metadata utilities
│   └── middleware.js           # NextAuth middleware
├── public/
│   ├── img/
│   │   ├── clients/            # Client logos
│   │   ├── case-studies/       # Case study images
│   │   └── logo.png
│   └── [favicon files]
├── db/
│   └── migrations/
└── tests/                      # Playwright tests

```

### **Application Flow**

---

## **Key Features**

### **1. Lead Generation System**

The contact form (`/contact`) includes sophisticated lead qualification:

**Qualification Scoring Algorithm** (src/app/api/contact/route.js:106):

**Scoring Breakdown:**

- Budget range (up to +3 points)
- Timeline urgency (+2 for immediate)
- Epic instance count (+3 for 50+)
- Middleware awareness (+2)
- Previous integration attempts (+2)
- Use case complexity (+2)
- Patient volume scale (+2)

**Database Schema:**

### **2. Admin Dashboard**

**Authentication Flow:**

ResendDBNextAuthAppBrowserResendDBNextAuthAppBrowseralt[Email in Whitelist][Email Not in Whitelist]UserClick Admin LoginNavigate to /adminCheck AuthRedirect to /admin-auth/loginEnter EmailSubmit EmailCheck admin_users tableUser FoundCreate Verification TokenSend Magic LinkEmail with LinkClick Magic LinkVerify TokenDelete TokenCreate JWT SessionAccess /adminShow DashboardUser Not FoundError: Not AuthorizedUser

**Easter Egg Access:**

- Click the logo on the footer CTA 3+ times to reveal admin login link
- Implemented in AdminEasterEggContext.jsx

**Features:**

- Lead management (`/admin/leads`)
- Individual lead details (`/admin/leads/[id]`)
- Analytics dashboard (`/admin/analytics`)

### **3. Analytics Tracking**

**Fathom Analytics** (src/lib/fathom.js):

**Key Tracked Events:**

- Form submissions (CRITICAL - qualified lead)
- Calendly clicks (HIGH - discovery call intent)
- Service page clicks (MEDIUM - service interest)
- Case study views (MEDIUM - social proof engagement)
- Site ID: `VOCMCRGZ`

### **4. Email System**

**Email Flow:**

ResendDatabaseAPIFormResendDatabaseAPIFormpar[Send Admin Email][Send Confirmation]UserAdminSubmit Contact FormPOST /api/contactValidate FieldsCalculate ScoreInsert LeadReturn Lead IDLog ActivitySend NotificationLead Alert EmailSend ConfirmationThank You EmailSuccess ResponseShow Success MessageUserAdmin

**Resend API Integration:**

- Contact form notifications (with qualification tier)
- Lead confirmation emails
- Magic link authentication emails
- Styled HTML email templates with inline CSS

---

## **Development Workflow**

### **Local Development**

```bash
# Install dependencies
npm install

# Start dev server (runs on port 3003)
npm run dev

# Run linter
npm run lint

# Run tests
npm test              # Playwright tests
npm run test:ui       # Playwright UI mode
npm run test:headed   # Playwright headed mode

```

**Important:** Dev server runs on **port 3003** (not default 3000) to avoid conflicts with other workspace projects.

### **Environment Variables**

Required variables in `.env.local`:

```bash
# Resend (Email)
RESEND_API_KEY=re_***

# Database
DATABASE_URL=postgresql://***

# NextAuth
NEXTAUTH_SECRET=***
NEXTAUTH_URL=http://localhost:3003

```

### **Database Setup**

- **Provider:** Neon (Vercel Postgres)
- **Connection:** Pooled connection via `@vercel/postgres`
- **Migrations:** Located in `db/migrations/`
- **Tables:**
    - `leads` - Contact form submissions
    - `lead_activities` - Activity log
    - `admin_users` - Whitelisted admin emails
    - `verification_tokens` - Magic link tokens

### **Git Workflow**

Current branch: `main`

Recent commits focus on:

- Login fixes
- Admin functionality
- Form patches
- Quick fixes

---

## **Component Patterns**

### **Radix UI Usage**

All pages require `'use client'` directive:

```jsx
'use client'

import { Container, Section, Heading, Text, Box, Grid, Card, Flex } from '@radix-ui/themes'

```

**Theme Configuration** (src/app/layout.jsx:63):

```jsx
<Theme accentColor="blue" grayColor="slate" radius="medium">

```

### **Component Hierarchy**

### **Navigation Component**

**RadixNavigation.jsx** includes:

- Fixed header with logo
- Desktop dropdown menus (Services, Products)
- Mobile hamburger menu
- Event tracking on all clicks
- Hover effects with inline styles

### **State Management**

---

## **API Routes**

### **POST /api/contact**

EmailDatabaseScoringValidationRouteClientEmailDatabaseScoringValidationRouteClientalt[Missing Fields][Valid]POST formDataCheck Required Fields400 ErrorCalculate ScoreInsert LeadLog ActivityReturn Lead IDSend Notifications200 Success + Lead ID

### **Authentication Flow**

---

## **SEO & Metadata**

**Structured Data Implementation:**

**Per-Page Metadata:**

- Dynamic metadata via `metadata` export
- Open Graph images
- Twitter Card support
- Canonical URLs

---

## **Case Studies**

Three featured case studies:

1. **Practice Rounds** (formerly eSpiral)
    - Medical education platform
    - EHR integration focus
    - Link: espiral.healthcare
2. **Lexmed AI**
    - AI-powered medical transcription
    - Disability hearings focus
    - Link: [lexmed.ai](http://lexmed.ai/)
3. **Graphite Atlas**
    - Graph database business intelligence
    - Internal 1Putt Health product

---

## **Testing**

**Playwright Configuration** (playwright.config.js):

- E2E test framework
- Tests in `tests/` directory
- UI mode available for debugging

---

## **Deployment**

**Platform:** Vercel

- CNAME file for custom domain
- Automatic deployments from Git
- Environment variables configured in Vercel dashboard

**Production URL:** [1putthealth.com](http://1putthealth.com/)

---

## **Code Style Guidelines**

Per `GHOSTWRITER.md`:

- Avoid AI writing patterns (excessive em dashes, hedging)
- Be concise and direct
- Use conversational language
- Match response length to complexity
- Minimize superlatives and buzzwords

**Project-Specific:**

- Use Radix UI components
- Inline styles preferred over CSS modules (except page.module.css)
- Event tracking on all user interactions
- Responsive design with mobile-first approach

---

## **Key Files Reference**

| **File** | **Purpose** | **Line References** |
| --- | --- | --- |
| `src/app/layout.jsx` | Root layout, Theme provider | - |
| `src/app/page.jsx` | Homepage with all sections | - |
| `src/app/api/contact/route.js` | Lead submission logic | `:106` (scoring), `:142` (email template) |
| `src/lib/auth.js` | NextAuth configuration | `:27` (whitelist check) |
| `src/middleware.js` | Route protection | `:4` (admin matcher) |
| `src/lib/fathom.js` | Analytics events | `:30` (event list) |
| `src/components/RadixNavigation.jsx` | Main navigation | - |

---

## **Common Tasks**

### **Adding a New Page**

### **Adding a New Service**

1. Create folder in `src/app/services/[service-name]/`
2. Follow existing service page structure
3. Add to Services dropdown in navigation
4. Add tracking event

### **Modifying Lead Qualification**

- Edit `calculateQualificationScore()` in `src/app/api/contact/route.js:106`
- Update tier thresholds if needed (`:24`)
- Adjust email templates (`:142` and `:223`)

### **Adding Admin Features**

- Add route under `src/app/admin/`
- Protected automatically by middleware
- Use `auth()` from `src/lib/auth.js` for server-side checks

---

## **Troubleshooting**

### **Common Issues**

**Port already in use:**

```bash
# Dev server uses port 3003, not 3000
npm run dev  # Starts on 3003

```

**Radix UI hydration errors:**

- Ensure `'use client'` directive at top of file
- Check for SSR/CSR mismatches

**Email sending fails:**

- Verify RESEND_API_KEY in .env.local
- Check Resend dashboard for quota/errors

**Admin login not working:**

- Ensure email exists in `admin_users` table
- Check NEXTAUTH_SECRET is set
- Verify NEXTAUTH_URL matches current URL

---

## **Resources**

- **Next.js 15 Docs:** [https://nextjs.org/docs](https://nextjs.org/docs)
- **Radix UI Themes:** [https://www.radix-ui.com/themes/docs](https://www.radix-ui.com/themes/docs)
- **Fathom Analytics:** [https://usefathom.com/docs](https://usefathom.com/docs)
- **NextAuth.js:** [https://next-auth.js.org/](https://next-auth.js.org/)
- **Resend API:** [https://resend.com/docs](https://resend.com/docs)

---

## **Next Steps for New Engineers**

1. ✅ Clone repository
2. ✅ Install dependencies (`npm install`)
3. ✅ Get `.env.local` credentials from team lead
4. ✅ Run dev server (`npm run dev`)
5. ✅ Test contact form locally
6. ✅ Review admin dashboard (request admin access)
7. ✅ Read through case study pages for content patterns
8. ✅ Review analytics events in Fathom dashboard
9. ✅ Run Playwright tests to ensure setup works
10. ✅ Make a small change to confirm workflow

---

## **Quick Reference**

### **Development Commands**

```bash
npm run dev          # Dev server on port 3003
npm run build        # Production build
npm start            # Run production build
npm run lint         # ESLint
npm test             # Playwright tests
npm run test:ui      # Playwright UI mode

```

### **Environment URLs**

- **Local:** [http://localhost:3003](http://localhost:3003/)
- **Production:** [https://1putthealth.com](https://1putthealth.com/)
- **Admin:** [https://1putthealth.com/admin](https://1putthealth.com/admin)

### **Key Dependencies Version Summary**

- Next.js: 15.5.6
- React: 18.3.1
- Radix UI Themes: 3.1.6
- NextAuth: 4.24.13
- Playwright: 1.57.0