import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`NEONPOKER server listening on http://localhost:${port}`);
}

void bootstrap();
