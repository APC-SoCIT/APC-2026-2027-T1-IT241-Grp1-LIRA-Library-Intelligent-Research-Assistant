import { Transform } from 'class-transformer';
import {
  IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength,
} from 'class-validator';

export const bookSummaryStatuses = ['generating', 'pending_review', 'approved', 'rejected', 'failed'] as const;
export type BookSummaryStatus = (typeof bookSummaryStatuses)[number];

export class BookSummaryResourceDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  resourceId!: string;
}

export class BookSummaryListQueryDto {
  @IsOptional()
  @IsIn(bookSummaryStatuses)
  status?: BookSummaryStatus;
}

export class ReviewBookSummaryDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(30000)
  summary?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value)
  @IsString()
  @MaxLength(2000)
  reviewerNote?: string | null;

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;
}
