import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CatalogResourceDto {
  @IsString() @MinLength(1) @MaxLength(2000) @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
  @IsOptional() @IsString() @MaxLength(100) format?: string;
  @IsOptional() @IsString() @MaxLength(200) label?: string;
}

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
  @IsOptional() @IsString() @MaxLength(2000) url?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CatalogResourceDto)
  resources?: CatalogResourceDto[];
  @IsOptional() @IsString() @MaxLength(2000) @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  coverUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) genres?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];
}
