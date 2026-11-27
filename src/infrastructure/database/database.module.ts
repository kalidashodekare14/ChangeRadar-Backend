import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantDb } from './tenant-db';

/** Shared by the API and Worker; both must connect with the runtime role. */
@Global()
@Module({
  providers: [PrismaService, TenantDb],
  exports: [PrismaService, TenantDb],
})
export class DatabaseModule {}
