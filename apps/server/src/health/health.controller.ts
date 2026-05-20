import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@neonpoker/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: HealthStatus } {
    return { status: 'ok' };
  }
}
