# Dependabot security updates — background and branch protection guide

## Why the GitHub-managed Dependabot job can fail with `security_update_not_needed`

GitHub runs a built-in, dynamic workflow called
`dynamic/dependabot/dependabot-updates` to apply Dependabot security updates.
When this runner is invoked in **security-update mode** and determines that no
advisory fix is required for a particular dependency, it reports:

```
security_update_not_needed  { "dependency-name": "minimatch" }
```

and exits with **code 1**, causing the workflow job to appear as failed in the
GitHub Actions UI.

This is a **false failure**. The repository code is fine — Dependabot is simply
reporting "nothing to do right now". Because the dynamic workflow is owned by
GitHub, its internal exit behaviour cannot be changed by adding or editing files
in this repository.

Example of the noisy failure pattern:
<https://github.com/Lint-Free-Technology/uix/actions/runs/24543643425/job/71754532366>

## The fix: a stable repo-owned required check

This repository contains a workflow that provides a reliable green status for
branch protection rules:

**`.github/workflows/dependabot-security-updates.yml`**

- Runs on a **daily schedule** and supports **`workflow_dispatch`**.
- Always exits successfully, even when Dependabot has nothing to update.
- Includes log output that explains the situation for anyone who looks at the
  run.
- Uses no permissions beyond the default read token
  (`permissions: {}`).

Dependabot security updates themselves remain **fully enabled** — GitHub will
still open pull requests automatically whenever a new advisory requires a
dependency update. This workflow simply decouples that noisy internal runner
signal from your required CI checks.

## How to configure branch protections

To stop the GitHub-managed Dependabot job from blocking merges, update your
branch protection rules so they require this workflow instead:

1. Go to **Settings → Branches** and open the protection rule for your
   protected branch (e.g. `master` or `dev`).
2. Under **Require status checks to pass before merging**, click
   **Add a status check**.
3. Search for and add:
   ```
   Dependabot security updates / status
   ```
   (this is the job name from `.github/workflows/dependabot-security-updates.yml`).
4. If the GitHub-managed check
   (`dynamic/dependabot/dependabot-updates`) is currently listed as a required
   check, **remove it** from the required checks list.
5. Save the branch protection rule.

After this change, the `dynamic/dependabot/dependabot-updates` job can still
run and report `security_update_not_needed` without blocking pull requests or
merge queues.
