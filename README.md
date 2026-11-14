# Recipe Mix

Recipe Mix is a recipe box for Indian home cooks. Add a recipe by hand or review pasted text, then save it with favourites and optional resized photos in IndexedDB on this device.

## Local development

Use Node.js **26.13.0** (LTS), pinned in `.nvmrc` and `package.json`. Use the same version for later CI.

```sh
npm ci
npm run dev
```

Open [the development Recipe Box](http://127.0.0.1:5173/#/recipes). For the production path locally, run `npm run build` and `npm run preview`, then open [the production Recipe Box](http://127.0.0.1:4183/recipe-mix-public/#/recipes). Hash routes work on a static host and the build uses `/recipe-mix-public/` for its assets.

## Review recipes

Search for `curry leaves` to find Poha, or combine cuisine, meal, dietary and total-time filters. At mobile widths, open **Filters** and use the bottom navigation. Choose **Add recipe** to enter servings, prep and cook times, ingredients, and method. Enter `0` for a time that does not apply. For quantities such as “salt to taste”, leave the amount blank and keep the text in the ingredient note.

Open any card to see its ingredients and method. Use the heart to favourite it and the **Recipe actions** menu to edit, duplicate or delete it. A duplicate starts with its own ID and photo record. A fresh database gets ten original starters once: Poha, Upma, Dal Tadka, Jeera Rice, Aloo Gobi, Chana Masala, Palak Paneer, Lemon Rice, Egg Bhurji and Chicken Curry. Databases created in earlier milestones keep their original recipes and any edits or deletions. Deleting every recipe leaves an empty Recipe Box. The development and production preview ports use separate browser storage.

For C2, choose **Add recipe → Paste recipe text** and paste a recipe with `Ingredients` and `Method` headings. Select **Read recipe**, check any highlighted quantities, and assign or remove lines whose section was unclear. The text is parsed in the browser. Select **Save recipe** when you are ready to keep it.

For C3, open **Poha** and change servings from 2 to 4 and back to 2. The ingredient amounts are calculated from the original quantities, and **Start cooking** carries your serving choice into Cook Mode. Open **Ingredients** to check amounts while cooking. Use **Previous**, **Next step**, **Finish cooking**, or **Exit** to move through the recipe. Cook Mode shows **Screen may dim** when a wake lock is unavailable.

For C4, create a collection in **Cookbooks** and use **Add recipes** or Recipe Detail’s cookbook picker to add recipes. Open **Planner** to schedule a meal by day and slot, or use **Add to plan** from Recipe Detail to carry over its current serving count. Use **Clear day** or **Clear week** to review the meals that will be removed. Deleting a recipe previews its cookbook and meal links before removing them together.

For C5, choose **Generate grocery list** in Planner. Open **By aisle** for totals or **By recipe** for each meal’s contribution. Checks are shared across both views. Add a manual item by typing a name and optional quantity, such as `Curd, 500 g`. After editing a plan or recipe, choose **Refresh from plan** when you’re ready to update the saved list. **Copy list** and **Share on WhatsApp** include the remaining items.

## Backups and offline use

Open [Settings in the production preview](http://127.0.0.1:4183/recipe-mix-public/#/settings). **Export backup** downloads version 1 JSON with your recipes, photos, cookbooks, meal plan, grocery state and starter seed marker. Keep that file private. With **Restore backup**, select a file and compare the counts. Use **Export current data first** to save a copy before choosing **Replace with backup**. A restore replaces the saved library in one transaction.

The production build caches the app under `/recipe-mix-public/`. When Settings shows **Ready to open offline on this device**, you can reopen the app and use recipes, cookbooks, Planner and Groceries offline. Settings offers **Reload to update** after a new build finishes caching. The update replaces the app files and keeps IndexedDB. The Vite development server leaves service workers disabled.

Use **Install Recipe Mix** in Settings for the steps for iPhone Safari, Android Chrome, or your computer. On another browser, profile, or device, use a backup to move your data. The install icons are based on the app’s original mark.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright suite builds the app and serves it on port 4174. To use an already installed browser, set `PLAYWRIGHT_CHANNEL` to `chrome` or `msedge` before running the suite.

## Publish to GitHub Pages

When you are ready to publish, set the source under **Settings → Pages → Build and deployment** to **GitHub Actions**. The [Pages workflow](.github/workflows/pages.yml) uses the Node version in `.nvmrc`, installs from the lockfile, and runs lint, type checking, unit tests, and Playwright. Playwright builds and serves the production files. Only that tested `dist/` directory is uploaded, and only `main` can deploy. You can also rerun the workflow manually from **Actions → Publish Recipe Mix to GitHub Pages → Run workflow**, choosing `main`.

Create an empty repository named `recipe-mix-public` and connect it as the remote for this local repository. The GitHub Pages site uses the new repository’s `/recipe-mix-public/` path. Find the published URL under **Settings → Pages**. After deployment, open and refresh the site’s `#/planner` route, verify offline readiness in Settings, and try installation and screen wake lock on a real phone.

For a regression, revert the offending commit on `main` and push the revert so the checks and deployment run again. Rolling back app files leaves browser data in IndexedDB. For any future database version change, test upgrades from the last published version and compatibility with a rollback before release. An older build may be unable to open a database already migrated to a newer version. If the rollback cannot read migrated data, ship a compatible fix or migration and use backups as the recovery path.

## Milestones

| Milestone | Scope |
| --- | --- |
| C0 | Scaffold, responsive shell, Recipe Box preview and hash routes |
| C1 | IndexedDB, Recipe Box and manual recipe editor |
| C2 | Paste-and-review parsing |
| C3 | Recipe Detail, serving scaling and Cook Mode |
| C4 | Cookbooks and weekly Meal Planner |
| C5 | Grocery snapshots, regeneration and sharing |
| C6 | Settings, backup and restore, offline installation and starter recipes |
| C7 | Release audit and GitHub Pages workflow |
| C8 | Verify the published site after owner publication |
