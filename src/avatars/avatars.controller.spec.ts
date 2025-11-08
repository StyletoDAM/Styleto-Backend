import { Test, TestingModule } from '@nestjs/testing';
import { AvatarController } from './avatars.controller';
import { AvatarService } from './avatars.service';

describe('AvatarsController', () => {
  let controller: AvatarController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvatarController],
      providers: [AvatarService],
    }).compile();

    controller = module.get<AvatarController>(AvatarController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
