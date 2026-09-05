import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  // crossOriginResourcePolicy is relaxed so the web app on another origin can
  // embed payslip PDFs served by this API.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties, and reject the request outright if any are
      // present, so clients cannot smuggle fields past the DTO contract.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PeoplePay360 API')
    .setDescription('Integrated HR & Payroll operations platform')
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');

  logger.log(`API listening on http://localhost:${port}/api`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

void bootstrap();
