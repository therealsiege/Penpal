import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  hooks: {
    postPackage: async (_forgeConfig, options) => {
      // Manually sign the macOS app after packaging.
      // Bypasses @electron/osx-sign because it fails on Electron's ad-hoc
      // pre-signed binaries. We call codesign directly with --force.
      if (options.platform !== 'darwin' || !process.env.APPLE_IDENTITY) return;
      const identity = process.env.APPLE_IDENTITY;
      const entitlements = path.resolve(__dirname, 'entitlements.plist');

      function signItem(itemPath: string) {
        execSync(
          `codesign --force --options runtime --timestamp --sign "${identity}" --entitlements "${entitlements}" "${itemPath}"`,
          { stdio: 'inherit', timeout: 60000 }
        );
      }

      for (const outputPath of options.outputPaths) {
        const apps = fs.readdirSync(outputPath).filter((f: string) => f.endsWith('.app'));
        for (const app of apps) {
          const appPath = path.join(outputPath, app);
          const contentsPath = path.join(appPath, 'Contents');
          const frameworksPath = path.join(contentsPath, 'Frameworks');

          console.log(`[forge] Signing ${app} (inside-out) with: ${identity}`);

          // 1. Sign ALL Mach-O binaries inside the bundle
          const allBinaries = execSync(
            `find "${contentsPath}" -type f \\( -perm +111 -o -name "*.node" -o -name "*.dylib" -o -name "*.so" \\) -exec sh -c 'file -b "$1" | grep -qw "Mach-O" && echo "$1"' _ {} \\;`,
            { encoding: 'utf-8', timeout: 60000 }
          ).trim().split('\n').filter(Boolean);

          for (const binary of allBinaries) {
            signItem(binary);
          }
          console.log(`[forge] Signed ${allBinaries.length} Mach-O binaries`);

          // 2. Sign helper .app bundles inside Frameworks
          if (fs.existsSync(frameworksPath)) {
            const helperApps = fs.readdirSync(frameworksPath)
              .filter((f: string) => f.endsWith('.app'))
              .map((f: string) => path.join(frameworksPath, f));
            for (const helperApp of helperApps) {
              signItem(helperApp);
            }
            console.log(`[forge] Signed ${helperApps.length} helper apps`);

            // 3. Sign framework bundles
            const frameworks = fs.readdirSync(frameworksPath)
              .filter((f: string) => f.endsWith('.framework'))
              .map((f: string) => path.join(frameworksPath, f));
            for (const framework of frameworks) {
              signItem(framework);
            }
            if (frameworks.length > 0) {
              console.log(`[forge] Signed ${frameworks.length} frameworks`);
            }
          }

          // 4. Sign the outer .app bundle last
          signItem(appPath);

          // Verify the entire bundle
          execSync(
            `codesign --verify --deep --strict --verbose=2 "${appPath}"`,
            { stdio: 'inherit' }
          );
          console.log(`[forge] Successfully signed and verified ${app}`);

          // Notarize if credentials are available
          if (process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD && process.env.APPLE_TEAM_ID) {
            const zipPath = path.join(outputPath, `${app}.zip`);
            console.log(`[forge] Zipping ${app} for notarization...`);
            execSync(
              `ditto -c -k --keepParent "${appPath}" "${zipPath}"`,
              { stdio: 'inherit', timeout: 120000 }
            );

            console.log(`[forge] Submitting ${app} for notarization...`);
            const submitResult = execSync(
              `xcrun notarytool submit "${zipPath}" --apple-id "${process.env.APPLE_ID}" --password "${process.env.APPLE_ID_PASSWORD}" --team-id "${process.env.APPLE_TEAM_ID}" --wait`,
              { stdio: 'pipe', timeout: 600000 }
            ).toString();
            console.log(submitResult);

            const accepted = submitResult.includes('Accepted');
            if (!accepted) {
              const idMatch = submitResult.match(/id:\s*([a-f0-9-]+)/);
              if (idMatch) {
                try {
                  const log = execSync(
                    `xcrun notarytool log "${idMatch[1]}" --apple-id "${process.env.APPLE_ID}" --password "${process.env.APPLE_ID_PASSWORD}" --team-id "${process.env.APPLE_TEAM_ID}"`,
                    { stdio: 'pipe', timeout: 30000 }
                  ).toString();
                  console.error(`[forge] Notarization REJECTED. Log:\n${log}`);
                } catch {
                  console.error('[forge] Notarization rejected and could not fetch log');
                }
              }
              console.error('[forge] Notarization was not accepted — app will trigger Gatekeeper warnings');
              fs.unlinkSync(zipPath);
              return;
            }

            // Staple the notarization ticket
            let stapled = false;
            for (let attempt = 1; attempt <= 5; attempt++) {
              try {
                execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
                stapled = true;
                break;
              } catch {
                console.log(`[forge] Staple attempt ${attempt}/5 failed, waiting 30s...`);
                await new Promise(r => setTimeout(r, 30000));
              }
            }
            if (!stapled) {
              console.warn('[forge] Stapling failed after 5 attempts — app is notarized but not stapled.');
            }
            fs.unlinkSync(zipPath);
            console.log(`[forge] Notarization complete${stapled ? ', stapled' : ''} ${app}`);
          }
        }
      }
    },
  },
  buildIdentifier: 'penny',
  outDir: 'forge-out',
  packagerConfig: {
    asar: true,
    name: 'Penny',
    executableName: 'penny',
    appBundleId: 'com.1putt.penny',
    appCategoryType: 'public.app-category.developer-tools',
    icon: './resources/icon',
    // Only include built output and public assets (electron-vite builds to out/)
    // Use function to override .gitignore (root gitignore excludes 'out')
    // Paths may be `/out/...` or `out/...` depending on platform — normalize before matching.
    ignore: (filePath: string) => {
      if (!filePath) return false;
      const n = filePath.replace(/\\/g, '/')
      const under = (dir: string) =>
        n === dir ||
        n === `/${dir}` ||
        n.startsWith(`${dir}/`) ||
        n.startsWith(`/${dir}/`)
      // Always include these (return false = do not ignore)
      if (n === 'package.json' || n === '/package.json') return false
      if (under('out')) return false
      if (under('public')) return false
      if (under('node_modules')) return false
      // Agent definitions + MCP profiles (required at runtime)
      if (under('agents')) return false
      // Exclude everything else
      return true
    },
    // osxSign/osxNotarize intentionally omitted — handled in postPackage hook
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      format: 'ULFO',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({
      ...(process.env.WINDOWS_CERTIFICATE_FILE ? {
        certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
        certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
      } : {}),
    }),
    new MakerDeb({}),
    new MakerRpm({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'therealsiege',
        name: 'sidekick',
      },
      prerelease: false,
      draft: false,
      force: true,
    }),
  ],
};

export default config;
