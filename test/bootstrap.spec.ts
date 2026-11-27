import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { WorkerModule } from '../src/worker.module';

describe('application bootstrap', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = undefined;
    }
  });

  it('compiles the API module', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef).toBeDefined();
  });

  it('compiles the Worker module', async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();

    expect(moduleRef).toBeDefined();
  });
});
