import { migrateLocalData } from '../lib/stars';
import { closeDatabase } from '../lib/storage';

async function main() {
  try { console.log(await migrateLocalData()); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Migration failed.'); process.exitCode = 1; }
  finally { await closeDatabase(); }
}
void main();
