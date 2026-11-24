import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { count } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { users, videos } from '../src/db/schema';

async function bootstrap() {
  const [{ value: videoCount }] = await db.select({ value: count() }).from(videos);
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);

  if (videoCount > 0 || userCount > 0) {
    console.log(
      `Database already initialized (${videoCount} videos, ${userCount} users); skipping initial seed.`,
    );
    return;
  }

  console.log('Empty database detected — running initial seed...');
  execFileSync('./node_modules/.bin/tsx', ['scripts/seed.ts'], { stdio: 'inherit' });
}

bootstrap()
  .catch((err) => {
    console.error('Database bootstrap failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
