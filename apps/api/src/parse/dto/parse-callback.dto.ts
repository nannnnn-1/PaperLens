import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsNumber,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";

class BboxDto {
  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @IsNumber()
  w?: number;

  @IsOptional()
  @IsNumber()
  h?: number;
}

class CallbackBlockDto {
  @IsNumber()
  blockIndex: number;

  @IsString()
  blockType: string;

  @IsOptional()
  @IsNumber()
  level?: number;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  translation?: string;

  @IsOptional()
  @IsNumber()
  pageNumber?: number;

  @IsOptional()
  bbox?: BboxDto;

  @IsOptional()
  @IsArray()
  embedding?: number[];
}

class CallbackEvidenceDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  blockIndex?: number;

  @IsOptional()
  @IsString()
  excerpt?: string;
}

class CallbackAnnotationDto {
  @IsString()
  type: string;

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
  evidence?: CallbackEvidenceDto[];

  @IsOptional()
  @IsNumber()
  blockIndex?: number;
}

class CallbackFigureDto {
  @IsNumber()
  figureIndex: number;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  objectKey?: string;

  @IsOptional()
  @IsString()
  thumbObjectKey?: string;

  @IsOptional()
  @IsString()
  aiAnalysis?: string;

  @IsOptional()
  @IsNumber()
  pageNumber?: number;

  @IsOptional()
  bbox?: BboxDto;
}

class CallbackMetricDto {
  @IsString()
  name: string;

  @IsOptional()
  value?: string | number;

  @IsOptional()
  @IsString()
  unit?: string;
}

class CallbackMethodCardDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  backbone?: string;

  @IsOptional()
  @IsArray()
  datasets?: { name?: string; splits?: string }[];

  @IsOptional()
  @IsArray()
  metrics?: CallbackMetricDto[];

  @IsOptional()
  @IsString()
  paramsCount?: string;

  @IsOptional()
  @IsBoolean()
  isCodeAvailable?: boolean;

  @IsOptional()
  @IsString()
  codeUrl?: string;

  @IsOptional()
  @IsArray()
  evidence?: CallbackEvidenceDto[];
}

class CallbackResultDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallbackBlockDto)
  blocks: CallbackBlockDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallbackAnnotationDto)
  annotations?: CallbackAnnotationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallbackFigureDto)
  figures?: CallbackFigureDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallbackMethodCardDto)
  methodCards?: CallbackMethodCardDto[];
}

export class ParseCallbackDto {
  @IsString()
  jobId: string;

  @IsUUID()
  paperId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CallbackResultDto)
  result: CallbackResultDto;

  @IsOptional()
  @IsString()
  error?: string;
}
