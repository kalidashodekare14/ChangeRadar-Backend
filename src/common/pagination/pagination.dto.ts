import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Default list pagination (ARCHITECTURE §10.2): page 1, 20 per page, max 100. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

/** Comparison changes default to 50 per page, max 100 (Phase 7). */
export class ChangePaginationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  override pageSize: number = 50;
}
