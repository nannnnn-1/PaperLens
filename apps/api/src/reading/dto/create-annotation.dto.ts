import { IsString, IsOptional, IsEnum, IsArray } from "class-validator";
import { AnnotationType } from "@prisma/client";

export class CreateAnnotationDto {
  @IsEnum(AnnotationType)
  type: AnnotationType;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  definition?: string;

  @IsOptional()
  @IsArray()
  evidence?: {
    type?: string;
    blockId?: string;
    figureId?: string;
    excerpt: string;
  }[];

  @IsOptional()
  @IsString()
  blockId?: string;
}
