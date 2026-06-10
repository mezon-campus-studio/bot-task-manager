import { Inject, Injectable, Logger } from '@nestjs/common';
import { MezonClient } from 'mezon-sdk';
import { setClientService } from './get-mezon-client';
import { NEZON_MODULE_OPTIONS } from '../nezon-configurable';
import { NezonModuleOptions } from '../nezon.module-interface';

@Injectable()
export class NezonClientService {
  private readonly logger = new Logger(NezonClientService.name);
  private client: MezonClient | null = null;
  private isLoggedIn = false;

  constructor(
    @Inject(NEZON_MODULE_OPTIONS)
    private readonly options: NezonModuleOptions,
  ) {
    setClientService(this);
  }

  getClient(): MezonClient {
    if (!this.client) {
      this.client = new MezonClient(this.options);
    }
    return this.client;
  }

  async login() {
    if (this.isLoggedIn) return;
    const client = this.getClient();

    try {
      await client.login();
      console.log('Login successful!');
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }

    client.on('close', () => {
      this.isLoggedIn = false;
    });
    this.isLoggedIn = true;
  }

  async disconnect() {
    if (!this.client) {
      return;
    }

    try {
      this.client.closeSocket();
    } catch (error) {
      this.logger.warn(
        'Failed to close Mezon socket during disconnect',
        (error as Error | undefined)?.stack,
      );
    } finally {
      this.client.removeAllListeners();
    }

    this.client = null;
    this.isLoggedIn = false;
  }
}
