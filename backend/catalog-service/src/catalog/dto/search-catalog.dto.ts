import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class SearchCatalogDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  q!: string;
}
