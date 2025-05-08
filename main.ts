import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/deno';

const app = new Hono();

app.use(logger());

app.get('/', (c) => c.text('Hello'));

// app.get('*', serveStatic({ path: './gray.svg' }));
app.get('*', (c) => {
  c.header('Content-Type', 'image/svg+xml');
  return c.body(`<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="#c3c3c3" /></svg>`);
});

Deno.serve(app.fetch);
