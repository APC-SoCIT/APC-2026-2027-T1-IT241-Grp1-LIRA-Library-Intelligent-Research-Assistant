import { Module } from '@nestjs/common';
import { LibrarianGuard } from '../shared/librarian.guard';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({ controllers: [KnowledgeController], providers: [KnowledgeService, LibrarianGuard] })
export class KnowledgeModule {}
