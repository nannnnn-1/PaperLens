import { IsString, IsOptional, IsEnum, IsArray } from "class-validator";
import { AnnotationType } from "@prisma/client";

export class CreateTermDto {
  @IsString()
  term: string;

  @IsString()
  definition: string;

  @IsOptional()
  @IsEnum(AnnotationType)
  category?: AnnotationType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}
