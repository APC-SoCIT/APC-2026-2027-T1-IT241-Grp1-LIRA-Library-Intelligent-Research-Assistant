import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class FaqChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(1200)
  content!: string;
}

export class AskFaqDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(1200)
  question!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => FaqChatMessageDto)
  history?: FaqChatMessageDto[];

  @IsOptional()
  @IsIn(['en', 'fil', 'zh', 'ja', 'ko'])
  language?: 'en' | 'fil' | 'zh' | 'ja' | 'ko';
}
