import { Test, TestingModule } from '@nestjs/testing';
import { ClothController } from './clothes.controller';
import { ClothesService } from './clothes.service';

describe('ClothesController', () => {
  let controller: ClothController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClothController],
      providers: [ClothesService],
    }).compile();

    controller = module.get<ClothController>(ClothController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
