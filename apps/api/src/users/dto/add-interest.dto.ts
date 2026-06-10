import { IsString } from "class-validator";

export class AddInterestDto {
  @IsString()
  keyword: string;
}
