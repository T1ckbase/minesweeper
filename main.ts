import { Hono } from 'hono';
// import { logger } from 'hono/logger';
import { Minesweeper } from './minesweeper.ts';
import { isGithubUserPath } from './utils.ts';

// TODO: check header referer

// https://t1ckbase-minesweeper.hf.space

const USER = 'T1ckbase';

const minesweeper = new Minesweeper(8, 8, 10, './images');

const app = new Hono();

// app.use(logger());

app.get('/', (c) => c.text(`Play minesweeper:\nhttps://github.com/${USER}`));

app.get('/headers', (c) => c.text(Array.from(c.req.raw.headers).join('\n')));

if (Deno.env.get('DENO_ENV') === 'development') {
  // app.get('/board', (c) => c.text(JSON.stringify(minesweeper.getBoard(), null, 2)));
  app.get('/board', (c) => c.text(minesweeper.getBoard().map((row) => row.map((cell) => cell.isMine ? 'b' : cell.adjacentMines).join('')).join('\n')));
}

app.get('/cell/:row/:col/image', (c) => {
  const row = Number(c.req.param('row'));
  const col = Number(c.req.param('col'));
  if (Number.isNaN(row) || Number.isNaN(col)) return c.text('Invalid coordinates', 400);

  const cellImage = minesweeper.getCellImage(row, col);
  if (!cellImage) return c.text(`Not Found: Image for cell (${row}, ${col}) could not be found. Coordinates may be invalid or no image is defined for this cell state.`, 404);

  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
  return c.body(cellImage);
});

app.get('/cell/:row/:col/click', (c) => {
  const row = Number(c.req.param('row'));
  const col = Number(c.req.param('col'));
  if (Number.isNaN(row) || Number.isNaN(col)) return c.text('Invalid coordinates', 400);

  const referer = c.req.header('Referer');
  let redirectUrl = `https://github.com/${USER}`;
  if (referer) {
    if (isGithubUserPath(referer, USER)) {
      redirectUrl = referer;
    } else {
      console.warn(`Invalid or non-GitHub referer: ${referer}`);
      // return c.text('?', 403);
    }
  } else {
    console.warn('Referer header is missing.');
    // return c.text('?', 403);
  }

  minesweeper.revealCell(row, col);

  return c.redirect(redirectUrl + '#minesweeper');
});

app.get('/game/status', (c) => {
  const image = minesweeper.getGameStatusImage();
  if (!image) return c.text('Status image is not available.', 404);

  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');
  return c.body(image);
});

app.get('/game/reset', (c) => {
  const referer = c.req.header('Referer');
  let redirectUrl = `https://github.com/${USER}`;
  if (referer) {
    if (isGithubUserPath(referer, USER)) {
      redirectUrl = referer;
    } else {
      console.warn(`Invalid or non-GitHub referer: ${referer}`);
      // return c.text('?', 403);
    }
  } else {
    console.warn('Referer header is missing.');
    // return c.text('?', 403);
  }

  try {
    minesweeper.resetGame();
  } catch (e) {
    console.warn(e instanceof Error ? e.message : e);
  }

  return c.redirect(redirectUrl + '#minesweeper');
});

Deno.serve(app.fetch);

Deno.cron('keep alive', '0 0 * * *', async () => { // keep alive?
  await fetch('https://t1ckbase-minesweeper.hf.space');
});
