// ---------------------------------------------------------------------------
// CLI entry point — `pocketforge` command
// ---------------------------------------------------------------------------

import { Command } from 'commander';
import pkg from '../../package.json';
import { push } from './push.js';
import { pull } from './pull.js';
import { generate } from './generate.js';
import { dev } from './dev.js';
import { log } from './log.js';
import { loadLocalEnv, resolveConnectionConfig } from './env.js';

const program = new Command();

loadLocalEnv();

program
  .name('pocketforge')
  .description('PocketForge — TypeScript schema DSL and typed client generator for PocketBase')
  .version(pkg.version);

// -- Global options helper --
function addConnectionOpts(cmd: Command): Command {
  return cmd
    .option('-u, --url <url>', 'PocketBase server URL')
    .option('-t, --token <token>', 'Superuser auth token')
    .option('-e, --email <email>', 'Superuser email')
    .option('-p, --password <password>', 'Superuser password');
}

// -- push --
addConnectionOpts(
  program
    .command('push')
    .description('Push TypeScript schema to PocketBase')
    .option('-s, --schema <path>', 'Path to schema file', 'pb_schema/schema.ts')
    .option('--delete-missing', 'Delete collections not in the schema', false)
    .option('--dry-run', 'Show what would be sent without applying', false),
).action(async (opts) => {
  try {
    const connection = resolveConnectionConfig(opts);
    await push({
      url: connection.url,
      token: connection.token,
      email: connection.email,
      password: connection.password,
      schema: opts.schema,
      deleteMissing: opts.deleteMissing,
      dryRun: opts.dryRun,
    });
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
});

// -- pull --
addConnectionOpts(
  program
    .command('pull')
    .description('Pull collections from PocketBase and generate a schema.ts file')
    .option('-o, --output <path>', 'Output schema file path', 'pb_schema/schema.ts')
    .option('--include-system', 'Include system collections', false),
).action(async (opts) => {
  try {
    const connection = resolveConnectionConfig(opts);
    await pull({
      url: connection.url,
      token: connection.token,
      email: connection.email,
      password: connection.password,
      output: opts.output,
      includeSystem: opts.includeSystem,
    });
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
});

// -- generate --
program
  .command('generate')
  .description('Generate TypeScript types and typed client from schema')
  .option('-s, --schema <path>', 'Path to schema file', 'pb_schema/schema.ts')
  .option('-o, --output <dir>', 'Output directory for generated files', 'pb_schema/generated')
  .option('--from-server', 'Generate types from server collections instead of local schema')
  .option('-u, --url <url>', 'PocketBase server URL (for --from-server)')
  .option('-t, --token <token>', 'Superuser auth token (for --from-server)')
  .option('-e, --email <email>', 'Superuser email (for --from-server)')
  .option('-p, --password <password>', 'Superuser password (for --from-server)')
  .action(async (opts) => {
    try {
      const connection = resolveConnectionConfig(opts);
      await generate({
        schema: opts.schema,
        output: opts.output,
        fromServer: opts.fromServer,
        url: connection.url,
        token: connection.token,
        email: connection.email,
        password: connection.password,
      });
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

// -- dev --
addConnectionOpts(
  program
    .command('dev')
    .description('Watch schema file and auto-push + generate on changes')
    .option('-s, --schema <path>', 'Path to schema file', 'pb_schema/schema.ts')
    .option('-o, --output <dir>', 'Output directory for generated files', 'pb_schema/generated')
    .option('--delete-missing', 'Delete collections not in the schema', false),
).action(async (opts) => {
  try {
    const connection = resolveConnectionConfig(opts);
    await dev({
      url: connection.url,
      schema: opts.schema,
      output: opts.output,
      token: connection.token,
      email: connection.email,
      password: connection.password,
      deleteMissing: opts.deleteMissing,
    });
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
});

program.parse();
