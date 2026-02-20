import { Injectable, Logger } from '@nestjs/common';
import { GrpcConfigService } from '@/grpc/grpc.service';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly grpcConfigService: GrpcConfigService) {}
}
