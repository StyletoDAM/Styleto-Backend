import { Test, TestingModule } from '@nestjs/testing';
import { SuitcaseService } from './suitcases.service';

describe('SuitcasesService', () => {
  let service: SuitcaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuitcaseService],
    }).compile();

    service = module.get<SuitcaseService>(SuitcaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
