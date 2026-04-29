// @ts-check

/**
 * Electron Forge config for Penpal.
 *
 * Run order:
 *   1. `electron-vite build` produces compiled main/preload/renderer in `out/`
 *      (configured in `electron.vite.config.ts`).
 *   2. `electron-forge package|make|publish` consumes `out/` to produce a
 *      packaged app, installer, and (for `publish`) a GitHub Release.
 *
 * macOS signing + notarization are gated on the APPLE_IDENTITY env var.
 * In CI, `.github/workflows/release.yml` sets that from secrets; locally
 * the values come from your shell. If unset, `npm run make` produces an
 * unsigned build that you'll need to xattr-clean before launching.
 */

const APPLE_IDENTITY = process.env.APPLE_IDENTITY
const APPLE_ID = process.env.APPLE_ID
const APPLE_ID_PASSWORD = process.env.APPLE_ID_PASSWORD
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID

const SIGN_AND_NOTARIZE =
  Boolean(APPLE_IDENTITY) &&
  Boolean(APPLE_ID) &&
  Boolean(APPLE_ID_PASSWORD) &&
  Boolean(APPLE_TEAM_ID)

const packagerConfig = {
  name: 'Penpal',
  appBundleId: 'com.retrohook.penpal',
  appCategoryType: 'public.app-category.developer-tools',
  icon: './resources/icon', // forge appends .icns / .ico per platform
  asar: true,
  // Files outside `out/` that should ship with the app bundle.
  // analytics/ stays as a co-located dev dependency for now (see CHANGELOG v0.1.1).
  extraResource: [],
  // Use a function so we can be precise — Forge passes the path relative to
  // the project root, starting with `/` and using forward slashes.
  // Returning true excludes the file. The /out/, /resources/, /package.json,
  // /node_modules/ paths must NOT be excluded — those are the runtime app.
  ignore: (file) => {
    if (!file) return false
    if (file === '/package.json' || file === '/package-lock.json') return false
    if (file.startsWith('/out/')) return false
    if (file.startsWith('/resources/')) return false
    if (file.startsWith('/node_modules/')) return false
    // Everything below is excluded from the packaged app:
    if (file === '/src' || file.startsWith('/src/')) return true
    if (file === '/tests' || file.startsWith('/tests/')) return true
    if (file === '/scripts' || file.startsWith('/scripts/')) return true
    if (file === '/build' || file.startsWith('/build/')) return true
    if (file === '/data' || file.startsWith('/data/')) return true
    if (file === '/playwright-report' || file.startsWith('/playwright-report/')) return true
    if (file === '/test-results' || file.startsWith('/test-results/')) return true
    if (file === '/.serena' || file.startsWith('/.serena/')) return true
    if (file === '/.env' || file.startsWith('/.env.')) return true
    if (file === '/analytics' || file.startsWith('/analytics/')) return true
    if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) return true
    if (file.endsWith('.tsbuildinfo')) return true
    return false
  },
  prune: true,
  ...(SIGN_AND_NOTARIZE
    ? {
        osxSign: {
          identity: APPLE_IDENTITY,
          'hardened-runtime': true,
          'gatekeeper-assess': false,
          entitlements: './build/entitlements.mac.plist',
          'entitlements-inherit': './build/entitlements.mac.plist',
          'signature-flags': 'library',
        },
        osxNotarize: {
          appleId: APPLE_ID,
          appleIdPassword: APPLE_ID_PASSWORD,
          teamId: APPLE_TEAM_ID,
        },
      }
    : {}),
}

const rebuildConfig = {}

const makers = [
  {
    name: '@electron-forge/maker-dmg',
    config: {
      icon: './resources/icon.icns',
      format: 'ULFO',
    },
  },
  {
    // Required for electron-updater auto-updates on macOS.
    name: '@electron-forge/maker-zip',
    platforms: ['darwin'],
  },
]

const publishers = [
  {
    name: '@electron-forge/publisher-github',
    config: {
      repository: {
        owner: 'therealsiege',
        name: 'Penpal',
      },
      prerelease: false,
      draft: false,
    },
  },
]

const plugins = [
  {
    name: '@electron-forge/plugin-auto-unpack-natives',
    config: {},
  },
]

module.exports = {
  // Write Forge's packaging output to `dist-forge/` so it doesn't collide with
  // `out/` (which is where electron-vite already writes the compiled bundle).
  // Without this, Forge auto-ignores `out/` to avoid circular copies and the
  // packaged app can't find its own main entry point.
  outDir: 'dist-forge',
  packagerConfig,
  rebuildConfig,
  makers,
  publishers,
  plugins,
}
