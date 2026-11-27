import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppException } from '../../common/errors/app.exception';
import { HealthService } from './health.service';

@SkipThrottle({ global: true })
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  liveness(): { status: string } {
    return this.health.liveness();
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; checks: unknown }> {
    const result = await this.health.readiness();
    if (result.status === 'error') {
      // Health endpoints are outside the §30 endpoint catalog; INTERNAL_ERROR
      // is the documented fallback code, with a 503 transport status.
      throw new AppException(
        'INTERNAL_ERROR',
        'One or more dependencies are unavailable',
        result.checks,
        503,
      );
    }
    return result;
  }
}
