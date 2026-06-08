// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Prefixo global da API
  app.setGlobalPrefix('api/v1');

  // CORS — permite o frontend acessar
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Validação automática de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // remove campos não declarados no DTO
      forbidNonWhitelisted: true,
      transform: true,          // converte tipos automaticamente
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger (documentação automática da API)
  const config = new DocumentBuilder()
    .setTitle('DisparesSMS API')
    .setDescription('Plataforma SaaS de disparo de SMS')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 API rodando em: http://localhost:${port}/api/v1`);
  logger.log(`📚 Docs em:        http://localhost:${port}/docs`);
}

bootstrap();
