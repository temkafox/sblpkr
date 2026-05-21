import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { resolveHttpCors } from './cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  app.enableCors(resolveHttpCors());
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`NEONPOKER server listening on http://localhost:${port}`);
}

void bootstrap();
