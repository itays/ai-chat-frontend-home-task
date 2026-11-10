import { loadScripts } from './script.ts';
import { createChatServer } from './server.ts';

const port = Number(process.env.PORT ?? 4000);
const delayScale = Number(process.env.DELAY_SCALE ?? 1);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer, got "${process.env.PORT}"`);
}
if (!Number.isFinite(delayScale) || delayScale < 0) {
  throw new Error(
    `DELAY_SCALE must be a non-negative number, got "${process.env.DELAY_SCALE}"`,
  );
}

const { httpServer } = createChatServer({ scripts: loadScripts(), delayScale });

httpServer.listen(port, () => {
  console.log(`Chat backend listening on http://localhost:${port}`);
});
