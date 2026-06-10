import { IsNumber, Min, Max } from "class-validator";

export class UpdateProgressDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  progress: number;
}
