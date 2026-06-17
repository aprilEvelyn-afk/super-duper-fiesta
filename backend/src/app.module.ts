import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { LedgerService } from './ledger.service';
import { AuthService } from './auth/auth.service';

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [AuthService, LedgerService],
})
export class AppModule {}
