import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ProxyModule } from '@/proxy/proxy.module';
import { ProductsProxyController } from './controllers/products-proxy.controller';

@Module({
  imports: [AuthModule, ProxyModule],
  controllers: [ProductsProxyController],
})
export class ProductsModule {}
