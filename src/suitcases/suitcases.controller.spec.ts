import { Test, TestingModule } from '@nestjs/testing';
import { SuitcasesController } from './suitcases.controller';
import { SuitcasesService } from './suitcases.service';

describe('SuitcasesController', () => {
  let controller: SuitcasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuitcasesController],
      providers: [SuitcasesService],
    }).compile();

    controller = module.get<SuitcasesController>(SuitcasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
