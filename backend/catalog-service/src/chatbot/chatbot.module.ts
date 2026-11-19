import { Module } from '@nestjs/common';
import { FaqChatbotController } from './faq-chatbot.controller';
import { FaqChatbotService } from './faq-chatbot.service';

@Module({
  controllers: [FaqChatbotController],
  providers: [FaqChatbotService],
})
export class ChatbotModule {}
