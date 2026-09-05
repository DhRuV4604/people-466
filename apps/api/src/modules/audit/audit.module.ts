import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { attachAuditTrail } from './audit.extension';

/**
 * Binds the query hook onto the one client every service already holds, before
 * the first request can reach it.
 */
@Injectable()
class AuditTrailBinder implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    attachAuditTrail(this.prisma);
  }
}

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditTrailBinder,
    // Global from here, so a module added tomorrow is audited without being told.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
