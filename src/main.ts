import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // ...or reject them (e.g. someone sending "role": "ADMIN")
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableCors();

  // only program images are public; CVs and materials go through authorized endpoints
  app.useStaticAssets('uploads/images', { prefix: '/uploads/images' });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Sanad Youth API running on http://localhost:${port}/api`);
}
await bootstrap();
