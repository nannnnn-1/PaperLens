import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ParseService } from "./parse.service";
import { ParseCallbackDto } from "./dto/parse-callback.dto";

@Controller("parse")
export class ParseController {
  constructor(private readonly parseService: ParseService) {}

  @Post("callback")
  @HttpCode(HttpStatus.OK)
  callback(@Body() dto: ParseCallbackDto) {
    return this.parseService.handleCallback(dto);
  }
}
