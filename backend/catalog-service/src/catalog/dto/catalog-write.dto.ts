import { IsArray, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';

export class CatalogWriteDto {
  @IsString() @MinLength(1) @MaxLength(500)
  title!: string;
  @IsOptional() @IsString() @MaxLength(500) author?: string;
  @IsOptional() @IsString() @MaxLength(50) isbn?: string;
  @IsOptional() @IsString() @MaxLength(500) publisher?: string;
  @IsOptional() @IsInt() @Min(0) publicationYear?: number;
  @IsOptional() @IsString() @MaxLength(500) publicationPlace?: string;
  @IsOptional() @IsString() @MaxLength(20) language?: string;
  @IsOptional() @IsString() @MaxLength(50) itemType?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) genres?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];
}
