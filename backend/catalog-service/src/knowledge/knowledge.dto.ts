import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class KnowledgeWriteDto {
  @IsIn(['faq', 'policy'])
  kind!: 'faq' | 'policy';

  @IsIn(['hours', 'services', 'rules', 'contact'])
  category!: 'hours' | 'services' | 'rules' | 'contact';

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(10000)
  content!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || null : value)
  @IsOptional() @IsString() @MaxLength(2000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, disallow_auth: true })
  sourceUrl?: string | null;
}

export class KnowledgeUpdateDto extends KnowledgeWriteDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;
}
