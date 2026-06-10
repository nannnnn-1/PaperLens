import { IsOptional, IsEnum, IsString } from "class-validator";
import { AnnotationType } from "@prisma/client";

export class TermListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(AnnotationType)
  type?: AnnotationType;
}
