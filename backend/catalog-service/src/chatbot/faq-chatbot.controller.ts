import { Body, Controller, Post } from '@nestjs/common';
import { AskFaqDto } from './dto/ask-faq.dto';
import { FaqChatbotService } from './faq-chatbot.service';

@Controller('api/chatbot')
export class FaqChatbotController {
  constructor(private readonly chatbot: FaqChatbotService) {}

  @Post('faq')
  answer(@Body() request: AskFaqDto) {
    return this.chatbot.answer(request);
  }
}
