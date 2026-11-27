import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigService } from '../../config/app-config.service';
import { AppConfigModule } from '../../config/config.module';
import { getCorrelationId } from '../http/correlation';
import { REDACTION_PATHS } from './redaction';

/** Shared structured logger for both the API and the Worker. */
@Module({})
export class LoggingModule {
  static forRoot(): DynamicModule {
    return LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          redact: { paths: REDACTION_PATHS, censor: '[REDACTED]' },
          genReqId: (request) => getCorrelationId(request),
          autoLogging: {
            ignore: (request) =>
              request.url === '/api/v1/health' || request.url === '/api/v1/health/ready',
          },
        },
      }),
    });
  }
}
