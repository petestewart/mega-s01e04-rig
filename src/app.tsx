import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read-night.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // Same readNight call as the page, no reshaping: the JSON and the page can't disagree.
  app.get('/api/digest/:night{\\d{4}-\\d{2}-\\d{2}}', (c) => {
    const result = readNight(config.runsDir, c.req.param('night'));
    if (result === null) return c.notFound();
    return c.json(result);
  });

  return app;
}
