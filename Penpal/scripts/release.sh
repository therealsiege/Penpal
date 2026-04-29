#!/usr/bin/env bash
# Penpal release helper.
#
# Usage:
#   npm run release -- patch   # 0.1.1 -> 0.1.2
#   npm run release -- minor   # 0.1.1 -> 0.2.0
#   npm run release -- major   # 0.1.1 -> 1.0.0
#
# Requires: clean working tree, on `main` branch, network access, gh CLI logged in.
# Pushing the tag triggers .github/workflows/release.yml to build & publish.

set -euo pipefail

BUMP="${1:-patch}"

if [[ ! "$BUMP" =~ ^(patch|minor|major)$ ]]; then
  echo "error: bump type must be one of: patch, minor, major" >&2
  exit 1
fi

# We must be at the Penpal/ root (npm run cd's us here automatically).
if [[ ! -f package.json ]] || ! grep -q '"name": "penpal"' package.json; then
  echo "error: run this from Penpal/ (npm run release -- $BUMP)" >&2
  exit 1
fi

# Refuse to release with a dirty tree.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is dirty. Commit or stash first." >&2
  git status --short
  exit 1
fi

# Refuse to release off main (override with FORCE=1).
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]] && [[ "${FORCE:-0}" != "1" ]]; then
  echo "error: release must run on main (you're on $BRANCH). Set FORCE=1 to override." >&2
  exit 1
fi

# Bump version (no auto git tag — we do that ourselves after CHANGELOG check).
NEW_VERSION="$(npm version "$BUMP" --no-git-tag-version | tr -d 'v')"
TAG="v${NEW_VERSION}"

echo ""
echo "Bumping to ${TAG}."
echo ""

# Sanity-check that CHANGELOG has a section for the new version.
if ! grep -q "## \[${NEW_VERSION}\]" CHANGELOG.md; then
  echo "warning: CHANGELOG.md has no entry for ${NEW_VERSION}." >&2
  echo "         Add a '## [${NEW_VERSION}] - YYYY-MM-DD' section before pushing." >&2
  echo "         The release tag will still be created — abort with Ctrl+C if not ready." >&2
  read -r -p "Continue anyway? [y/N] " response
  [[ "$response" =~ ^[Yy]$ ]] || { git checkout -- package.json; exit 1; }
fi

# Commit, tag, push.
git add package.json
git commit -m "chore: release ${TAG}"
git tag -a "${TAG}" -m "Release ${TAG}"
git push origin main "${TAG}"

echo ""
echo "Tag ${TAG} pushed. GitHub Actions will now build and publish the release."
echo "Watch: gh run watch"
