import { Test, TestingModule } from '@nestjs/testing';
import { GrpcConfigService } from './grpc.service';

describe('GrpcConfigService', () => {
  let service: GrpcConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GrpcConfigService],
    }).compile();

    service = module.get<GrpcConfigService>(GrpcConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
