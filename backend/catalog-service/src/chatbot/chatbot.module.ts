import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ChatHistoryController } from './chat-history.controller';
import { ChatHistoryGuard } from './chat-history.guard';
import { ChatHistoryService } from './chat-history.service';
import { FaqChatbotController } from './faq-chatbot.controller';
import { FaqChatbotService } from './faq-chatbot.service';

@Module({
  imports: [KnowledgeModule],
  controllers: [FaqChatbotController, ChatHistoryController],
  providers: [FaqChatbotService, ChatHistoryService, ChatHistoryGuard],
})
export class ChatbotModule {}
