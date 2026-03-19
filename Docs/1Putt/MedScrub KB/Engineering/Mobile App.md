
| Field | Value |
|-------|-------|
| Created | March 7, 2026 |
| Updated | March 7, 2026 |
| Tags | Engineering |

---

## Overview

The MedScrub Mobile App is a React Native companion app built with Expo SDK 54 that serves as a **secure viewer and notification endpoint** for physician workflows generated on the desktop. The app does not generate AI outputs -- all LLM calls happen on the desktop (trusted environment) or via scheduled jobs. The mobile app receives push notifications, fetches de-identified content from the platform, and re-identifies it through the hospital-hosted proxy when the physician is on-network.

Primary workflows:

1. **Daily Briefing** -- Receive push notification when briefing is ready, view structured patient summaries with re-identified PHI
2. **PHI Scrubbing** -- Paste or dictate clinical text, de-identify it through the proxy, copy scrubbed output
3. **PHI Restore** -- Paste an LLM response containing tokens, select a session, re-identify to restore original PHI
4. **Session History** -- Browse and manage de-identification sessions (up to 50 stored locally)
5. **Enrollment** -- QR code scan to pair with a hospital's proxy deployment

The Daily Briefing is the hero feature. The mobile app is the primary consumption surface for briefings -- physicians review their day's patient summaries on their phone before arriving at the clinic.

---

## Architecture

The app follows Expo's managed workflow with file-based routing via Expo Router.

**Routing hierarchy:**

```
Root Layout (_layout.tsx)
  -> BiometricAuth gate (Face ID / Touch ID)
  -> Onboarding (first launch only)
  -> Stack Navigator
      -> index.tsx (routing logic: configured? -> briefing tab, else -> settings)
      -> login.tsx (platform JWT auth)
      -> enroll.tsx (QR-based physician enrollment)
      -> briefings.tsx (full briefing list)
      -> (tabs)/
          -> briefing.tsx     # Hero tab -- today's briefing + recent list
          -> workflows.tsx    # AI clinical workflows
          -> scrub.tsx        # PHI de-identification
          -> restore.tsx      # PHI re-identification (hidden from tab bar)
          -> history.tsx      # Session history
          -> settings.tsx     # Proxy config, enrollment, diagnostics
      -> briefing/[id].tsx    # Briefing detail (structured patient cards)
```

Key architectural decisions:

- File-based routing via Expo Router (React Navigation under the hood)
- `medscrub://` deep linking scheme for push notification navigation
- Zustand for state management with SecureStore persistence
- Axios HTTP client with interceptors for global error handling
- No local PHI storage -- only session IDs and de-identified content cached
- All credentials encrypted via `expo-secure-store` (iOS Keychain, Android Keystore)

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81.x | Cross-platform mobile runtime |
| React | 19.x | Component framework |
| Expo SDK | 54 | Managed workflow, OTA updates, EAS Build |
| TypeScript | 5.9.x | Type-safe development (strict mode) |
| Expo Router | 6.x | File-based navigation |
| Zustand | 5.x | Lightweight state management |
| Axios | 1.13.x | HTTP client for proxy and platform APIs |
| @medplum/core | 4.5.x | FHIR R4 utilities |
| @medplum/fhirtypes | 4.5.x | FHIR TypeScript type definitions |
| expo-secure-store | 15.x | Encrypted credential storage |
| expo-local-authentication | 17.x | Biometric authentication (Face ID, Touch ID) |
| expo-notifications | 0.32.x | Push notifications (Expo Push Service) |
| expo-camera | 17.x | QR code scanning for enrollment |
| @react-native-voice/voice | 3.2.x | Voice dictation for clinical text input |
| @react-native-community/netinfo | 11.4.x | Network status monitoring |

---

## State Management (Zustand)

Five stores manage all app state, each persisted to `expo-secure-store` (encrypted) with auto-hydration on launch.

| Store | Key State | Purpose |
|-------|-----------|---------|
| `proxy-store` | `proxyUrl`, `apiKey`, `userId`, `hospitalId`, `organizationName`, `physicianName`, `deviceId` | Proxy connection config, set via QR enrollment |
| `auth-store` | `isAuthenticated`, `user`, `token`, `balance` | Platform JWT authentication and credit balance |
| `session-store` | `sessions[]` (max 50) | De-identification session history |
| `briefing-store` | `briefings[]`, `currentBriefing`, `todayBriefing`, `unviewedCount` | Daily briefing state, re-identification logic |
| `connection-store` | `status`, `errorType`, `proxyVersion`, `lastChecked` | Proxy health monitoring |

**Storage strategy:**
- **SecureStore** (encrypted): API keys, JWT tokens, session mappings, proxy credentials
- **AsyncStorage** (unencrypted): App preferences, onboarding completion flag
- **In-memory only**: Current briefing detail, re-identified content (never persisted)

---

## Daily Briefing (Hero Feature)

### Generation (Desktop) -> Consumption (Mobile)

The Daily Briefing follows a **split architecture**: the desktop generates, the mobile consumes.

```
Desktop App
  |  Physician triggers briefing (manual or scheduled)
  |  Batch-processes patients via pre-visit-summary + daily-briefing-header skills
  |  Uploads de-identified briefing to platform
  v
Platform (medscrub.ai)
  |  Stores briefing in Postgres (DailyBriefing table)
  |  Looks up physician's active push tokens (PushToken table)
  |  Sends push notification via Expo Push Service
  v
Mobile App
  |  Receives push notification
  |  Foreground: in-app alert + auto-refresh briefing list
  |  Background/tap: navigate to /briefing/[id]
  |
  |  Fetches de-identified briefing from platform
  |  GET /api/briefings/:id
  v
PHI Proxy (hospital network)
  |  For each patient item + overview:
  |  POST /api/reidentify with sessionId
  |  Restores [NAME_1], [DATE_1] -> original PHI
  v
Physician
  |  Views structured briefing with real patient names
  |  Collapsible patient cards with sections:
  |  Active problems, medications, labs, allergies,
  |  screening gaps, medication compliance, actionable flags
```

### Briefing Data Model

```typescript
BriefingSummary {
  id, date, status
  patientCount, completedCount
  pushSent, viewedAt, createdAt
}

BriefingDetail extends BriefingSummary {
  overviewContent      // De-identified schedule overview
  overviewSessionId    // Session for re-identifying overview
  items: BriefingItem[]
}

BriefingItem {
  patientId, patientName          // De-identified until re-id
  content                         // De-identified clinical summary
  sessionId                       // For re-identification
  appointmentTime, appointmentType
  status, orderIndex
  reidentifiedContent?            // Populated after re-id
  structuredContent?              // Parsed JSON sections
}

StructuredContent {
  sections: [{
    type       // "active-problems" | "medications" | "labs" | etc.
    title      // Human-readable section header
    content    // Section body text
    items?: [{ severity, label, detail }]  // Actionable flags
  }]
}
```

### Re-identification Requirement

Mobile briefing viewing requires **proxy connectivity** (hospital WiFi or VPN). If the physician is off-network:
- De-identified content is displayed with token placeholders
- A warning banner appears: "Connect to your clinic network to view patient details"
- Briefing is still navigable but not clinically useful without PHI

This is an intentional security design -- PHI is never cached on the device. Re-identification happens live through the proxy.

---

## Mobile as a Skill Output Adapter

### Current State

Today, only the Daily Briefing uses the mobile app as an output destination. The flow is:

1. Desktop executes skills (`pre-visit-summary`, `daily-briefing-header`)
2. Uploads de-identified output to platform
3. Platform sends push notification
4. Mobile fetches and re-identifies

### Future: Generic Push Adapter for Skills

The Skill SDK's Phase 3 (Adapter Runtime) introduces output adapters that can route skill results to different targets. The mobile app is a natural output adapter for any skill that produces alerts, notifications, or summaries a physician should see on-the-go.

**Proposed `mobile-push` output adapter:**

```jsonc
// In a .skill.json file
{
  "adapters": {
    "output": [
      {
        "type": "mobile-push",
        "title": "Critical Lab Result",          // Push notification title
        "body": "{{patientName}} - {{labName}}", // Interpolated body
        "channel": "alerts",                     // Android notification channel
        "priority": "high",                      // high | default | low
        "data": {
          "type": "skill-result",
          "skillId": "lab-triage",
          "resultId": "{{resultId}}"
        }
      }
    ]
  }
}
```

**Skills that would benefit from mobile push:**

| Skill | Push Use Case | Priority |
|-------|---------------|----------|
| `lab-triage` | Critical lab result alerts | high |
| `screening-gap-analyzer` | Care gap reminders for upcoming patients | default |
| `pre-visit-summary` | Individual patient prep ready | default |
| `daily-briefing-header` | Full briefing ready (existing) | high |
| `message-*` (future) | Patient message drafts ready for review | default |
| Prior auth status (future) | Authorization approved/denied | high |

**Implementation path:**

1. **Platform endpoint** -- `POST /api/skill-results` accepts de-identified skill output with push metadata
2. **Push delivery** -- Platform looks up physician's active tokens, sends via Expo Push Service
3. **Mobile navigation** -- Deep link `medscrub://skill-result/{id}` routes to a generic skill result viewer
4. **Re-identification** -- Same proxy-based pattern as Daily Briefing (fetch de-identified, re-identify on network)

This turns the mobile app from a single-purpose briefing viewer into a **notification hub for all clinical AI output**.

---

## Push Notifications

### Architecture

Push notifications use Expo's Push Notification Service, which routes to APNs (iOS) and FCM (Android).

**Registration flow:**

1. App checks device capabilities (`expo-notifications`)
2. Requests user permission
3. Gets Expo push token (project ID: `5b2f4925-175d-4b3c-9d76-fbf7f4bb2033`)
4. Registers token with platform: `POST /api/push-tokens`
5. Platform stores in `PushToken` table (userId, token, platform, deviceId, active)
6. On logout, deregisters: `DELETE /api/push-tokens`

**Notification handling:**

| Context | Behavior |
|---------|----------|
| App in foreground | In-app alert with "View" button, auto-refresh briefing list |
| App in background (tapped) | Navigate to `/briefing/[id]` via deep link |
| App killed (tapped) | Launch app, navigate to briefing detail |

**Android channels:**
- `default` -- General notifications
- `briefings` -- Daily briefing alerts (configurable by user)

**Badge management:**
- Badge count synced to `unviewedCount` from briefing store
- Updated on fetch, mark-viewed, and logout

---

## Authentication

### Three Auth Layers

| Layer | Method | Storage | Purpose |
|-------|--------|---------|---------|
| Device | Biometric (Face ID / Touch ID) | OS-level | Gate app access on launch |
| Platform | JWT token (24hr) | SecureStore | Authenticate with medscrub.ai APIs |
| Proxy | API key (`msk_*`) | SecureStore | Authenticate with hospital proxy |

### Biometric Authentication

- Auto-detects available hardware (Face ID, Touch ID, Iris)
- Triggers automatically on app launch
- Falls back to device passcode
- Gracefully degrades if no biometric hardware or enrollment
- Configurable via `EXPO_PUBLIC_BIOMETRIC_AUTH` environment variable

### QR Enrollment Flow

```
Settings screen -> Tap "Scan QR Code"
  -> Camera opens, scans QR
  -> Extracts QRCodePayload: { proxyUrl, hospitalId, organizationId, organizationName }
  -> Navigate to /enroll
  -> Physician enters: name, email, password
  -> POST /api/mobile/enroll -> credentials + org info
  -> Save to proxy-store (encrypted in SecureStore)
  -> POST /api/mobile/register-device -> register with platform
  -> Navigate to /(tabs)/briefing
```

Password requirements: 8+ characters, 1 number, 1 uppercase letter.

---

## Network & Connectivity

### Connection Monitor

The app continuously monitors proxy connectivity via a health check loop:

- **Interval:** 60 seconds
- **On app foreground:** Immediate check
- **NetInfo integration:** Detects network type changes

### Error Classification

| Error Type | Cause | User Message |
|------------|-------|--------------|
| `network` | No internet connection | "No internet connection" |
| `vpn` | Proxy unreachable (timeout) | "Connect to hospital network or VPN" |
| `unauthorized` | API key revoked or invalid | "Access has been revoked" |
| `server` | Proxy returning 5xx | "Proxy server is down" |

### Proxy vs. Platform Connectivity

The mobile app connects to **two separate backends**:

| Backend | URL Source | Auth | Required For |
|---------|-----------|------|-------------|
| **Proxy** (hospital) | QR enrollment | `X-API-Key` | De-identify, re-identify, session management |
| **Platform** (medscrub.ai) | Hardcoded | `Authorization: Bearer` JWT | Briefings, push tokens, credits, enrollment |

The proxy requires hospital network access (WiFi or VPN). The platform is publicly accessible over the internet.

---

## API Surface

### Proxy Endpoints (Hospital-Hosted)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Proxy health check |
| `/api/deidentify` | POST | De-identify clinical text |
| `/api/reidentify` | POST | Re-identify text (restore PHI) |
| `/api/fhir/deidentify` | POST | De-identify FHIR R4 resource |
| `/api/fhir/reidentify` | POST | Re-identify FHIR resource |
| `/api/session` | GET | Get session info |
| `/api/session` | DELETE | Delete session |

### Platform Endpoints (medscrub.ai)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mobile/enroll` | POST | Physician enrollment |
| `/api/mobile/register-device` | POST | Device registration |
| `/api/briefings` | GET | List briefings |
| `/api/briefings/:id` | GET | Briefing detail (de-identified) |
| `/api/briefings/:id` | PATCH | Mark briefing as viewed |
| `/api/credits/balance` | GET | Credit balance |
| `/api/credits/deduct` | POST | Deduct credits after scrub |
| `/api/push-tokens` | POST | Register push token |
| `/api/push-tokens` | DELETE | Deregister push token |

---

## Security

### PHI Protection

- **No PHI stored on device** -- only session IDs and de-identified content
- **Re-identification is live** -- PHI restored in-memory via proxy, never persisted
- **Session auto-expiry** -- 24-hour TTL on proxy sessions
- **Biometric gate** -- Face ID / Touch ID required before app access
- **Encrypted credentials** -- All keys and tokens in `expo-secure-store`

### Network Security

- HTTPS/TLS 1.3 for all API communication
- Proxy accessible only on hospital network (WiFi/VPN)
- VPN detection via connection timeout classification
- No PHI in error logs -- sanitized error messages only

### App Permissions

| Permission | iOS Key | Purpose |
|------------|---------|---------|
| Camera | `NSCameraUsageDescription` | QR code scanning, document capture |
| Microphone | `NSMicrophoneUsageDescription` | Voice dictation |
| Face ID | `NSFaceIDUsageDescription` | Biometric authentication |
| Notifications | System prompt | Daily briefing alerts |

### Enterprise Distribution

- **MDM support** -- Distributable via Jamf (iOS) and Intune (Android)
- **Device registration** -- Platform tracks enrolled devices per physician
- **Remote wipe** -- Via MDM policy (app data cleared)
- **License validation** -- Perpetual license users billed $4/month for mobile access

---

## Key Directories

```
mobile/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout, biometric gate, onboarding
│   ├── index.tsx                 # Entry routing logic
│   ├── login.tsx                 # Platform JWT login
│   ├── enroll.tsx                # QR enrollment form
│   ├── briefings.tsx             # Full briefing list
│   ├── (tabs)/                   # Tab navigator
│   │   ├── briefing.tsx          # Hero tab: today's briefing
│   │   ├── workflows.tsx         # AI clinical workflows
│   │   ├── scrub.tsx             # PHI de-identification
│   │   ├── restore.tsx           # PHI re-identification
│   │   ├── history.tsx           # Session history
│   │   └── settings.tsx          # Proxy config, enrollment
│   └── briefing/
│       └── [id].tsx              # Briefing detail with patient cards
│
├── components/                   # Reusable components
│   ├── BiometricAuth.tsx         # Biometric authentication gate
│   ├── ConnectionStatus.tsx      # Proxy connection indicator
│   ├── OnboardingScreen.tsx      # First-launch walkthrough
│   └── ...                       # Additional UI components
│
├── lib/                          # Utilities and services
│   ├── medscrub-client.ts        # Proxy + platform API client (singleton)
│   ├── notifications.ts          # Push notification setup and handlers
│   ├── connection-monitor.ts     # Proxy health check loop
│   ├── diagnostics.ts            # Network diagnostics modal
│   └── ...                       # Additional utilities
│
├── stores/                       # Zustand state management
│   ├── proxy-store.ts            # Proxy connection config
│   ├── auth-store.ts             # Platform authentication
│   ├── session-store.ts          # De-identification sessions
│   ├── briefing-store.ts         # Daily briefing state + re-id logic
│   └── connection-store.ts       # Proxy connectivity status
│
├── assets/                       # Images, fonts, icons
├── __tests__/                    # Test files
├── app.json                      # Expo app configuration
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config (strict)
```

---

## Development

### Prerequisites

- Node.js 18+
- npm
- Expo CLI (`npx expo`)
- iOS Simulator (Xcode) or Android Emulator (Android Studio)
- Expo Go app (for quick testing) or development build (for voice dictation, camera)

### Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Launch iOS simulator |
| `npm run android` | Launch Android emulator |
| `npm test` | Run Vitest test suite |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Yes | Platform API base URL (medscrub.ai) |
| `EXPO_PUBLIC_BIOMETRIC_AUTH` | No | Enable biometric gate (`true`/`false`) |

### Build & Distribution

| Platform | Method | Output |
|----------|--------|--------|
| iOS | EAS Build | `.ipa` for TestFlight / App Store |
| Android | EAS Build | `.aab` for Play Store Internal Testing |
| OTA | `expo publish` | Over-the-air JavaScript updates |

### Code Style

- Functional components with hooks (no class components)
- PascalCase file names for components (`BiometricAuth.tsx`)
- camelCase for utilities and stores (`medscrub-client.ts`)
- Zustand stores with TypeScript interfaces
- No `any` types
- Import order: external packages, internal absolute imports (`@/`), relative imports, type imports
