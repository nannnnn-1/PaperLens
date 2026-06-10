import { IsString, IsOptional } from "class-validator";

export class CreateNoteDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  blockId?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
