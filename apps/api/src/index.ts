import { loadConfig } from './config.js';
import { buildServer } from './server.js';

async function main() {
  const config = loadConfig();
  const app = await buildServer({ config });

  try {
    await app.listen({ port: config.OVOTE_API_PORT, host: config.OVOTE_API_HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.once(sig, async () => {
      app.log.info({ sig }, 'shutting down');
      await app.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
