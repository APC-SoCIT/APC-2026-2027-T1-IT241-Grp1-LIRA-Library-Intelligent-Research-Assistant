import { ConfigService } from '@nestjs/config';
import { createApp } from './create-app';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService);

  const port = config.get<number>('app.port', 3001);
  await app.listen(port);
}

void bootstrap();
