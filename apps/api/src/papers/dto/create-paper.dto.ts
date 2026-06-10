import { IsString, IsArray, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class AuthorDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  affiliation?: string;
}

export class CreatePaperDto {
  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuthorDto)
  authors: AuthorDto[];

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  arxivId?: string;
}
