import { Controller, Get } from '@nestjs/common';
import { HealthService } from '../../application/health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): string {
    return this.healthService.getMessage();
  }

  @Get('health')
  getDetailedHealth() {
    return this.healthService.check();
  }
}
