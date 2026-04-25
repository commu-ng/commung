import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { community, installedApp, membership } from "../src/drizzle/schema";
import { getBuiltinApp } from "../src/services/builtin-commands";
import * as installedAppService from "../src/services/installed-app.service";

async function main() {
  const helpApp = getBuiltinApp("help");
  if (!helpApp) {
    console.error("help app missing from catalog; aborting");
    process.exit(1);
  }

  const communities = await db
    .select({ id: community.id, slug: community.slug })
    .from(community)
    .where(isNull(community.deletedAt));
  console.log(`Found ${communities.length} active communities`);

  if (communities.length === 0) return;

  const alreadyInstalled = await db
    .select({ communityId: installedApp.communityId })
    .from(installedApp)
    .where(
      and(
        eq(installedApp.builtinId, helpApp.id),
        isNull(installedApp.deletedAt),
        inArray(
          installedApp.communityId,
          communities.map((c) => c.id),
        ),
      ),
    );
  const installedSet = new Set(alreadyInstalled.map((r) => r.communityId));

  let installed = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of communities) {
    if (installedSet.has(c.id)) {
      skipped++;
      continue;
    }

    const owner = await db.query.membership.findFirst({
      where: and(
        eq(membership.communityId, c.id),
        eq(membership.role, "owner"),
      ),
      columns: { userId: true },
    });
    if (!owner) {
      console.warn(`[skip] ${c.slug}: no owner membership found`);
      failed++;
      continue;
    }

    try {
      await installedAppService.installApp(c.id, helpApp.id, {
        profileName: helpApp.defaultProfile.name,
        profileUsername: helpApp.defaultProfile.username,
        installedById: owner.userId,
      });
      console.log(`[ok] ${c.slug}: help installed`);
      installed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[fail] ${c.slug}: ${message}`);
      failed++;
    }
  }

  console.log(
    `Done. installed=${installed}, skipped=${skipped}, failed=${failed}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("backfill error", err);
    process.exit(1);
  });
