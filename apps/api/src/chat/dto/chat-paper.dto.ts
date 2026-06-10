import { IsString, IsOptional, IsArray, IsBoolean } from "class-validator";

export class ChatPaperDto {
  @IsString()
  paperId: string;

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

  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}
