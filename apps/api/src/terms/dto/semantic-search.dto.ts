import { IsString, IsOptional, IsInt } from "class-validator";
import { Type } from "class-transformer";

export class SemanticSearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  topK?: number = 5;
}
