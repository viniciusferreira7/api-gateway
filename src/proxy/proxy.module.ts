import { Module } from '@nestjs/common';
import { HttpModule } from '@/http/http.module';
import { ProxyService } from './services/proxy.service';

@Module({
  imports: [HttpModule],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
