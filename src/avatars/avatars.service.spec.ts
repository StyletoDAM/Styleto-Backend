import { Test, TestingModule } from '@nestjs/testing';
import { AvatarService } from './avatars.service';

describe('AvatarsService', () => {
  let service: AvatarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AvatarService],
    }).compile();

    service = module.get<AvatarService>(AvatarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
