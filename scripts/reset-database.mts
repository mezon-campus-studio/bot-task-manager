import { NestFactory } from '@nestjs/core';

async function main() {
  // Dynamic imports avoid CJS/ESM interop issues caused by .mts + module=commonjs
  const seederModuleMod = await import('../src/seeders/seeder.module');
  const { SeederModule } = seederModuleMod as unknown as { SeederModule: unknown };

  const mod = await import('../src/seeders/database.seeder');
  const { DatabaseSeeder } = mod as unknown as { DatabaseSeeder: unknown };

  const app = await NestFactory.createApplicationContext(SeederModule as any);
  const seederService = app.get<any>(DatabaseSeeder as any);

  try {
    await seederService.resetDatabase();
  } finally {
    await app.close();
  }
}

void main();
