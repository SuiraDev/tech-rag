import { Module } from '@nestjs/common';
import { HealthService } from './application/health.service';
import { HealthController } from './presentation/http/health.controller';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
