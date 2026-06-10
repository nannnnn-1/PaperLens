import { IsOptional, IsInt, IsString, IsBooleanString } from "class-validator";
import { Type } from "class-transformer";

export class PaperListQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBooleanString()
  favorite?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
