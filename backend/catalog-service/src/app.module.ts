import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogModule } from './catalog/catalog.module';
import { configuration, validateEnvironment } from './config/configuration';
import { HealthModule } from './health/health.module';
import { PatronsModule } from './patrons/patrons.module';
import { ChatbotModule } from './chatbot/chatbot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    CatalogModule,
    HealthModule,
    PatronsModule,
    ChatbotModule,
  ],
})
export class AppModule {}
