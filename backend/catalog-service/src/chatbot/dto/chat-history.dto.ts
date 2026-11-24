import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, IsUrl, MaxLength,
  ValidateNested,
} from 'class-validator';

export class ChatPreferenceDto {
  @IsBoolean()
  saveHistory!: boolean;
}

export class CreateChatSessionDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;
}

export class ChatCitationDto {
  @IsString()
  @MaxLength(50)
  style!: string;

  @IsString()
  @MaxLength(6000)
  text!: string;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url?: string | null;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  missingFields!: string[];
}

export class ChatKnowledgeSourceDto {
  @IsString()
  @MaxLength(100)
  id!: string;

  @IsIn(['faq', 'policy'])
  kind!: 'faq' | 'policy';

  @IsIn(['hours', 'services', 'rules', 'contact'])
  category!: 'hours' | 'services' | 'rules' | 'contact';

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  sourceUrl?: string | null;
}

export class ChatConversationMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(12000)
  content!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChatCitationDto)
  citation?: ChatCitationDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ChatKnowledgeSourceDto)
  matchedKnowledge?: ChatKnowledgeSourceDto[];
}
