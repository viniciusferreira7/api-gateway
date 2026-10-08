import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ProxyModule } from '@/proxy/proxy.module';
import { CartProxyController } from './controllers/cart-proxy.controller';

@Module({
  imports: [AuthModule, ProxyModule],
  controllers: [CartProxyController],
})
export class CheckoutModule {}
