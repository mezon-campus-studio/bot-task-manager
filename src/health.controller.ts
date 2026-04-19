import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class HealthController {
  @Get('healthz')
  @Version(VERSION_NEUTRAL)
  getHealth() {
    return { status: 'ok' };
  }
}
