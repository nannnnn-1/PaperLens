import { IsString, IsOptional, IsArray } from "class-validator";

export class CreateQADto {
  @IsString()
  question: string;

  @IsOptional()
  @IsString()
  selectedText?: string;

  @IsOptional()
  @IsArray()
  surroundingBlockIds?: string[];

  @IsOptional()
  @IsString()
  sessionId?: string;
}
