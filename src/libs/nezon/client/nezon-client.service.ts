import { Inject, Injectable } from '@nestjs/common';
import { MezonClient } from 'mezon-sdk';
import { setClientService } from './get-mezon-client';
import { NEZON_MODULE_OPTIONS } from '../nezon-configurable';
import { NezonModuleOptions } from '../nezon.module-interface';

@Injectable()
export class NezonClientService {
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
      console.log('Bot config options:', JSON.stringify(this.options));
      this.client = new MezonClient(this.options);
    }
    return this.client;
  }

  async login() {
    if (this.isLoggedIn) return;
    const client = this.getClient();

    console.log('Attempting login with botId:', this.options.botId);

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
    this.client.closeSocket();
    this.client.removeAllListeners();
    this.client = null;
    this.isLoggedIn = false;
  }
}
