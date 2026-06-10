import { IsOptional, IsEnum } from "class-validator";
import { AnnotationType } from "@prisma/client";

export class AnnotationQueryDto {
  @IsOptional()
  @IsEnum(AnnotationType)
  type?: AnnotationType;
}
