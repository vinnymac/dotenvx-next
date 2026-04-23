#!/usr/bin/env bash
# setup.sh — One-time project setup for @fantasticfour/dotenvx-next
# Leave this file untracked; do not commit it.
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
BOLD=$(tput bold)
DIM=$(tput dim)
RESET=$(tput sgr0)
GREEN=$(tput setaf 2)
CYAN=$(tput setaf 6)
YELLOW=$(tput setaf 3)
RED=$(tput setaf 1)
MAGENTA=$(tput setaf 5)

# ─── Helpers ─────────────────────────────────────────────────────────────────
step() {
  echo
  echo "${BOLD}${CYAN}━━━ Step $1: $2 ${RESET}"
  echo
}

info()    { echo "  ${CYAN}→${RESET} $*"; }
success() { echo "  ${GREEN}✓${RESET} $*"; }
warn()    { echo "  ${YELLOW}!${RESET} $*"; }
error()   { echo "  ${RED}✗${RESET} $*" >&2; }
code()    { echo "  ${DIM}$ $*${RESET}"; }

pause() {
  local msg="${1:-Done? Press Enter to continue…}"
  echo
  echo "  ${MAGENTA}▶${RESET} ${BOLD}${msg}${RESET}"
  read -r
}

require() {
  if ! command -v "$1" &>/dev/null; then
    error "Required tool not found: $1"
    error "Install it and re-run this script."
    exit 1
  fi
  success "$1 found ($(command -v "$1"))"
}

# ─── Header ──────────────────────────────────────────────────────────────────
echo
echo "${BOLD}${MAGENTA}dotenvx-next — First-Time Project Setup${RESET}"
echo "${DIM}@fantasticfour/dotenvx-next${RESET}"
echo

# ─── Prerequisites ───────────────────────────────────────────────────────────
step 0 "Checking prerequisites"
require git
require gh
require pnpm
require npm

# Verify gh auth
if ! gh auth status &>/dev/null; then
  error "gh is not authenticated. Run: gh auth login"
  exit 1
fi
success "gh is authenticated"

# ─── Step 1: GitHub repo + push ──────────────────────────────────────────────
step 1 "Create GitHub repo and push"

REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)

if [[ -n "$REMOTE_URL" ]]; then
  warn "Remote 'origin' already set to: $REMOTE_URL"
  warn "Skipping repo creation. Proceeding with push."
else
  info "Creating public GitHub repo: vinnymac/dotenvx-next"
  gh repo create vinnymac/dotenvx-next \
    --public \
    --description "Next.js plugin that loads dotenvx secrets early"
  git remote add origin https://github.com/vinnymac/dotenvx-next.git
  success "Remote set to https://github.com/vinnymac/dotenvx-next.git"
fi

info "Staging all changes…"
git add -A

if git diff --cached --quiet; then
  warn "Nothing new to commit — working tree is clean."
else
  info "Committing…"
  git commit -m "Add pnpm, Biome, Vitest, Changesets, CI workflows"
  success "Committed."
fi

info "Pushing to origin/main…"
git push -u origin main
success "Pushed."

# ─── Step 2: GitHub release environment (browser) ────────────────────────────
step 2 "Create GitHub release environment"

echo "  You need to create a deployment environment named ${BOLD}release${RESET} in GitHub."
echo
echo "  1. Open: ${CYAN}https://github.com/vinnymac/dotenvx-next/settings/environments${RESET}"
echo "  2. Click ${BOLD}New environment${RESET}"
echo "  3. Name it exactly:  ${BOLD}${GREEN}release${RESET}  (case-sensitive)"
echo "  4. Click ${BOLD}Configure environment${RESET} → Save"
echo

pause "Done creating the 'release' environment? Press Enter to continue…"
success "Continuing."

# ─── Step 3: First-time npm publish ──────────────────────────────────────────
step 3 "First-time npm publish"

info "Building the package…"
pnpm build
success "Build complete."

echo
info "Running a dry-run to preview what will be published:"
echo
npm pack --dry-run
echo

pause "Review the file list above. Press Enter to publish (you may be prompted for 2FA)…"

info "Publishing @fantasticfour/dotenvx-next to npm…"
npm publish --access public
success "Published to npm!"

# ─── Step 4: npm automation token → GitHub secret ────────────────────────────
step 4 "Generate npm automation token and add to GitHub"

echo "  You need a Granular Access Token from npmjs.com."
echo
echo "  1. Open: ${CYAN}https://www.npmjs.com/settings/~/tokens${RESET}"
echo "  2. Click ${BOLD}Generate New Token${RESET} → ${BOLD}Granular Access Token${RESET}"
echo "  3. Under ${BOLD}Packages and scopes${RESET}:"
echo "       - Select ${BOLD}@fantasticfour/dotenvx-next${RESET}"
echo "       - Permission: ${BOLD}Read and write${RESET}"
echo "  4. Under ${BOLD}Organizations${RESET}: select ${BOLD}@fantasticfour${RESET}"
echo "  5. Copy the generated token."
echo

pause "Have the token copied to your clipboard? Press Enter…"

echo
echo -n "  Paste the npm token here (input hidden): "
read -rs NPM_TOKEN
echo
echo

info "Adding NPM_TOKEN to GitHub release environment…"
gh secret set NPM_TOKEN \
  --repo vinnymac/dotenvx-next \
  --env release \
  --body "$NPM_TOKEN"
unset NPM_TOKEN
success "NPM_TOKEN secret added to the 'release' environment."

# ─── Step 5: npm Trusted Publishing / OIDC ───────────────────────────────────
step 5 "Configure npm Trusted Publishing (OIDC)"

echo "  This lets future releases publish without a token via GitHub Actions OIDC."
echo
echo "  1. Open: ${CYAN}https://www.npmjs.com/package/@fantasticfour/dotenvx-next${RESET}"
echo "  2. Go to ${BOLD}Settings${RESET} → ${BOLD}Trusted Publishers${RESET}"
echo "  3. Click ${BOLD}Add GitHub Actions${RESET} and fill in:"
echo "       Owner:     ${BOLD}vinnymac${RESET}"
echo "       Repo:      ${BOLD}dotenvx-next${RESET}"
echo "       Workflow:  ${BOLD}release.yml${RESET}"
echo "       Environment: ${BOLD}release${RESET}"
echo "  4. Save."
echo

pause "Done setting up Trusted Publishing? Press Enter…"
success "Trusted Publishing configured."

# ─── Step 6: Ongoing changeset workflow ──────────────────────────────────────
step 6 "Ongoing changeset workflow (reference)"

echo "  Every future release follows this pattern:"
echo
echo "  ${DIM}# 1. Create a changeset (pick bump type + write summary)${RESET}"
code "pnpm changeset"
echo
echo "  ${DIM}# 2. Commit and push the changeset${RESET}"
code "git add .changeset/ && git commit -m \"Add changeset\" && git push"
echo
echo "  ${DIM}# 3. CI opens a \"Version Packages\" PR — merge it${RESET}"
echo "  ${DIM}# 4. CI publishes to npm and pushes the git tag${RESET}"
echo

# ─── Done ────────────────────────────────────────────────────────────────────
echo
echo "${BOLD}${GREEN}━━━ All done! ━━━${RESET}"
echo
echo "  Repo:    ${CYAN}https://github.com/vinnymac/dotenvx-next${RESET}"
echo "  Package: ${CYAN}https://www.npmjs.com/package/@fantasticfour/dotenvx-next${RESET}"
echo
echo "  You can delete ${BOLD}setup.sh${RESET} — it is not tracked by git."
echo
