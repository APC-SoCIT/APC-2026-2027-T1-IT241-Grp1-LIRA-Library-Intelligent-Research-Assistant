import {
  Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { ChatHistoryGuard, ChatHistoryRequest } from './chat-history.guard';
import {
  ChatConversationMessageDto, ChatPreferenceDto, CreateChatSessionDto,
} from './dto/chat-history.dto';
import { ChatHistoryService } from './chat-history.service';

@Controller('api/chatbot')
@UseGuards(ChatHistoryGuard)
export class ChatHistoryController {
  constructor(private readonly history: ChatHistoryService) {}

  @Get('preferences')
  @Header('Cache-Control', 'no-store')
  getPreference(@Req() request: ChatHistoryRequest) {
    return this.history.getPreference(request.chatUser.id);
  }

  @Put('preferences')
  @Header('Cache-Control', 'no-store')
  setPreference(@Req() request: ChatHistoryRequest, @Body() input: ChatPreferenceDto) {
    return this.history.setPreference(request.chatUser.id, input.saveHistory);
  }

  @Get('conversations')
  @Header('Cache-Control', 'no-store')
  listConversations(@Req() request: ChatHistoryRequest) {
    return this.history.listSessions(request.chatUser.id);
  }

  @Post('conversations')
  @Header('Cache-Control', 'no-store')
  createConversation(@Req() request: ChatHistoryRequest, @Body() input: CreateChatSessionDto) {
    return this.history.createSession(request.chatUser.id, input.title);
  }

  @Put('conversations/:id')
  @Header('Cache-Control', 'no-store')
  renameConversation(
    @Req() request: ChatHistoryRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateChatSessionDto,
  ) {
    return this.history.renameSession(request.chatUser.id, id, input.title);
  }

  @Get('conversations/:id')
  @Header('Cache-Control', 'no-store')
  getConversation(@Req() request: ChatHistoryRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.history.getSession(request.chatUser.id, id);
  }

  @Post('conversations/:id/messages')
  @Header('Cache-Control', 'no-store')
  addMessage(
    @Req() request: ChatHistoryRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ChatConversationMessageDto,
  ) {
    return this.history.addMessage(request.chatUser.id, id, input);
  }

  @Delete('conversations/:id')
  @Header('Cache-Control', 'no-store')
  async deleteConversation(@Req() request: ChatHistoryRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.history.deleteSession(request.chatUser.id, id);
    return { deleted: true };
  }

  @Delete('conversations')
  @Header('Cache-Control', 'no-store')
  deleteAllConversations(@Req() request: ChatHistoryRequest) {
    return this.history.deleteAllSessions(request.chatUser.id);
  }
}
