import { Module } from '@nestjs/common';
import { HttpModule } from '@/http/http.module';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';

/**
 * Register and login are forwarded to the users service, which also decides
 * whether a token still authenticates someone (`ValidateTokenGuard`). The
 * gateway verifies no JWT itself.
 */
@Module({
  imports: [HttpModule],
  providers: [AuthService],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
