import { Body, Controller, INestApplication, Post, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/common/errors/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';

class CreateProbeDto {
  @IsString()
  title!: string;
}

@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() body: CreateProbeDto): CreateProbeDto {
    return body;
  }
}

describe('global validation, filter and envelope', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      // Same settings as main.ts bootstrap.
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps successful responses in the success envelope', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/probe')
      .set('X-Request-Id', 'req-42')
      .send({ title: 'hello' })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: { title: 'hello' },
      correlationId: 'req-42',
    });
  });

  it('rejects unknown properties with VALIDATION_ERROR', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/probe')
      .send({ title: 'hello', injected: true })
      .expect(422);

    const body = response.body as Record<string, unknown>;
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.correlationId).toEqual(expect.any(String));
    expect(body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'property' })]),
    );
  });

  it('rejects missing required fields', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/probe')
      .send({})
      .expect(422);

    expect((response.body as Record<string, unknown>).errorCode).toBe('VALIDATION_ERROR');
  });
});
