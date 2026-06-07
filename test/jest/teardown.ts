import { NO_POSTGRES, stopPostgres } from './postgres';

export default async function teardownJest() {
  const promises: Promise<unknown>[] = [];

  if (!NO_POSTGRES) {
    promises.push(stopPostgres());
  }

  return Promise.all(promises);
}
