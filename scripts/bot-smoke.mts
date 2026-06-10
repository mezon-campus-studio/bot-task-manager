import { MezonClient } from 'mezon-sdk';

const READY_TIMEOUT_MS = Number(process.env.BOT_SMOKE_TIMEOUT_MS ?? 20000);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

async function withTimeout<T>(
  operation: Promise<T>,
  label: string,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${READY_TIMEOUT_MS}ms`));
        }, READY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function waitForReady(client: MezonClient): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(`Bot did not become ready within ${READY_TIMEOUT_MS}ms`),
      );
    }, READY_TIMEOUT_MS);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onClose = () => {
      cleanup();
      reject(new Error('Bot socket closed before ready'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      client.off('ready', onReady);
      client.off('close', onClose);
    };

    client.once('ready', onReady);
    client.once('close', onClose);
  });
}

async function main(): Promise<void> {
  const client = new MezonClient({
    botId: requiredEnv('MEZON_BOT_ID'),
    token: requiredEnv('MEZON_BOT_TOKEN'),
    wsUrl: process.env.MEZON_WS_URL?.trim() || 'gw.mezon.ai',
  });

  try {
    await withTimeout(client.login(), 'Bot login');
    await withTimeout(waitForReady(client), 'Bot ready wait');
    console.log('Bot smoke test passed: Mezon client reached ready state.');
  } finally {
    try {
      client.closeSocket();
    } catch {
      // Ignore cleanup failures during smoke-test shutdown.
    }
    client.removeAllListeners();
  }
}

void main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Bot smoke test failed.',
    );
    process.exit(1);
  });
