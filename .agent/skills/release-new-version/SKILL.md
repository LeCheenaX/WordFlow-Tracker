---
name: release-new-version
description: Prepare and publish a new Wordflow Tracker version. Load when bumping versions, writing release notes, tagging releases, re-releasing a withdrawn package, or updating release statistics.
---

# Release New Version Skill

Use this skill when preparing a new Wordflow Tracker release.

This skill is project-specific. It is based on the recent `version update`
commits and the current GitHub Actions release workflow.

## Evidence From Recent Release Commits

Recent `version update` commits consistently changed:

- `manifest.json`: bump `version`.
- `src/changeLog.ts`: update `currentPluginVersion` and prepend bilingual release notes.

Occasional release commits also changed:

- `miscellaneous/downloads-Trend.py`: append or correct download data by version.
- `miscellaneous/cumulative_downloads_trend.png`: regenerate the chart.
- `styles.css`: only when the release itself includes CSS changes.

Important current-project caveats:

- `version-bump.mjs` can update `manifest.json` and `versions.json`, but the recent release commits did not update `versions.json`.
- `package.json` currently has an unrelated sample version (`1.0.1`), so do not treat `package.json` as the release source of truth without explicit user confirmation.
- The release source of truth is currently `manifest.json` plus `src/changeLog.ts`.

## Release Philosophy

Obsidian plugin exposure is driven heavily by download activity. Prefer frequent
small releases when there is a real bug fix, small feature, or improvement.

Use SemVer loosely but pragmatically for this project:

- `X.y.z`: major architecture changes, breaking behavior, large UI/product repositioning, or many bundled features.
- `x.Y.z`: core feature updates or meaningful feature batches.
- `x.y.Z`: bug fixes, small features, small refactors, UI polish, performance improvements, or release-cadence updates.

For discovery, a single small bug fix or a single small feature can justify a
patch release.

## Files To Check Before Editing

Read these before making release edits:

- `manifest.json`
- `src/changeLog.ts`
- `versions.json`
- `package.json`
- `.github/workflows/release.yml`
- `miscellaneous/downloads-Trend.py`, if updating release statistics

Inspect recent version commits when uncertain:

```terminal
git log --oneline --decorate -n 30
git show <version-update-commit> -- manifest.json src/changeLog.ts
```

## Version Bump Workflow

1. Choose the next version.
   - Default to the next patch version unless the user asks for a larger bump or the change clearly deserves it.
   - Do not add a leading `v`; tags must be plain versions such as `2.2.10`.

2. Update `manifest.json`.
   - Set `version` to the target version.
   - Keep `minAppVersion` unchanged unless there is a real compatibility reason.

3. Update `src/changeLog.ts`.
   - Set `currentPluginVersion` to the same target version.
   - Prepend the new release section at the top of both `en` and `zh-CN`.
   - Keep the newest release first.

4. Decide whether `versions.json` should be updated.
   - For Obsidian plugins, `versions.json` maps plugin versions to required Obsidian app versions.
   - If maintaining compatibility metadata, add `"targetVersion": "minAppVersion"`.
   - Because recent commits have not kept it current, ask or note the inconsistency before changing it.

5. Optionally update release statistics.
   - Follow the "Download Statistics Workflow" below.
   - Update `miscellaneous/downloads-Trend.py` with new version rows or corrected counts.
   - Regenerate `miscellaneous/cumulative_downloads_trend.png`.

## Download Statistics Workflow

Use this when the user asks to update download data, refresh the chart, or
prepare release analytics.

The current chart data lives in `miscellaneous/downloads-Trend.py`:

```python
data = [
    ("2026-06-25", 0, "2.2.9"),
]
```

Each tuple means:

- release date: `YYYY-MM-DD`
- downloads for that release/tag: integer, not cumulative
- version tag: exact Git tag, without leading `v`

The script computes cumulative downloads itself and appends an `unreleased`
point for today's date. Do not enter cumulative totals into `data`.

### Pull Data From GitHub Release Stats

Primary data source:

```text
https://qwertycube.com/github-release-stats/
```

Manual browser workflow:

1. Open GitHub Release Stats.
2. Enter the owner and repository:
   - owner: `LeCheenaX`
   - repository: `WordFlow-Tracker`
3. Fetch the repository release stats.
4. For each release tag, read:
   - tag/version, such as `2.2.9`
   - release date
   - total download count for that release
5. Compare the website values against the existing rows in `downloads-Trend.py`.
6. Add missing release rows and correct stale counts.

When the site shows per-asset counts, use the release total across release
assets, not only one asset. The release workflow uploads `main.js`,
`manifest.json`, and `styles.css`; the chart tracks release-level downloads.

### Fallback Via GitHub API

If the website is unavailable or cannot be accessed from the current agent
environment, fetch equivalent data from the GitHub Releases API:

```terminal
gh api repos/LeCheenaX/WordFlow-Tracker/releases
```

For each release:

- use `tag_name` as the version
- use `published_at` or `created_at` as the release date
- sum `assets[].download_count` to get the release download count

Only use this fallback when the user accepts GitHub API data as equivalent to
the website source.

### Update `downloads-Trend.py`

Keep rows sorted by release date, and preserve same-day releases in version
order:

```python
("2026-06-19", 10, "2.2.7"),
("2026-06-19", 306, "2.2.8"),
("2026-06-25", 0, "2.2.9"),
```

For a brand-new release, add a row using the release date and current download
count. It is normal for a just-created release to start at `0`.

For an existing release, replace the old count with the latest count from the
data source. Do not add a duplicate row for the same version.

### Regenerate The Chart

After editing `downloads-Trend.py`, run:

```terminal
python miscellaneous/downloads-Trend.py
```

This overwrites:

```text
miscellaneous/cumulative_downloads_trend.png
```

Then verify:

```terminal
git diff -- miscellaneous/downloads-Trend.py
git status --short
```

If the image changed, include both the script and PNG in the release-statistics
update.

## Changelog Structure

Write release notes so users can scan the impact immediately.

Use these buckets when applicable:

- `🚀 Key Insights`: short headline for the release, tied to the version's main point.
- `🔥 Major Updates`: large core updates.
- `✨ New Features`: small features and new capabilities.
- `⚡ Enhancements`: refactors, optimizations, behavior improvements.
- `🎨 UI Optimization`: visual and interaction polish.
- `🐛 Fixes`: bug fixes.

English heading format:

```ts
### 2.2.10 updates
✨ **New Features:**
- ...
```

Chinese heading format:

```ts
### 2.2.10 更新说明
✨ **新功能：**
- ...
```

Keep English and Chinese notes aligned in meaning, but write them naturally.

## Verification

Before tagging:

```terminal
npm run build
git diff -- manifest.json src/changeLog.ts versions.json miscellaneous/downloads-Trend.py
git status --short
```

Check these manually:

- `manifest.json` version equals `currentPluginVersion`.
- Changelog top section matches the target version in both languages.
- The tag to be pushed exactly matches `manifest.json.version`.
- The repo is on the intended branch, usually `main`.
- Any release stats/chart changes are intentional.

## Git And Release Rules

Follow `obsidian-ops`: do not run `git commit`, `git push`, or automatic staging
without explicit user approval for each step.

The current workflow at `.github/workflows/release.yml` triggers on every tag
push and creates a draft GitHub release with:

- `main.js`
- `manifest.json`
- `styles.css`

The release workflow builds on GitHub Actions, attaches artifact attestations,
and creates the release as a draft.

## Publish Commands

After the user approves committing and publishing, create a version commit, then
tag and push the tag.

Standard release:

```terminal
git tag -a 2.2.10 -m "2.2.10"
git push WordFlow-Tracker 2.2.10
```

`-a` creates an annotated version tag. `-m` sets the tag message.

After pushing:

- Check the GitHub Actions release workflow.
- Confirm the draft release exists.
- Review release notes and attached assets before publishing the GitHub release.

## Withdraw And Re-release

Use this only when a broken release/tag needs to be replaced.

Confirm the exact version first. The example below re-releases `2.2.10`.

```terminal
git tag -d 2.2.10
git push WordFlow-Tracker main --delete 2.2.10
git tag -a 2.2.10 -m "2.2.10"
git push WordFlow-Tracker 2.2.10
```

Before re-tagging:

- Ensure the fixed code is committed on `main`.
- Ensure `manifest.json` and `src/changeLog.ts` still match the tag.
- Confirm whether the existing GitHub draft/release should be deleted or edited.

## Common Pitfalls

- Do not push a tag with a leading `v`.
- Do not let `manifest.json` and `src/changeLog.ts` disagree.
- Do not assume `package.json.version` is authoritative in this repo.
- Do not forget the Chinese changelog section.
- Do not run release git operations without explicit user approval.
- Do not publish the draft release blindly; GitHub Actions creates it as a draft for review.
