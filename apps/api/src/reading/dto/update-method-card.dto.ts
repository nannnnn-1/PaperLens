import { IsOptional, IsString, IsArray } from "class-validator";

export class UpdateMethodCardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  metrics?: { name: string; value: string | number; unit?: string }[];

  @IsOptional()
  @IsArray()
  evidence?: {
    type?: string;
    blockId?: string;
    figureId?: string;
    excerpt: string;
  }[];
}
