import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { TermsService } from "./terms.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TermListQueryDto } from "./dto/term-list-query.dto";
import { CreateTermDto } from "./dto/create-term.dto";
import { SemanticSearchDto } from "./dto/semantic-search.dto";

@Controller("terms")
@UseGuards(JwtAuthGuard)
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get()
  search(@Query() query: TermListQueryDto) {
    return this.termsService.search(query);
  }

  @Get(":term")
  findOne(@Param("term") term: string) {
    return this.termsService.findOne(term);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTermDto) {
    return this.termsService.create(dto);
  }

  @Post("search/semantic")
  semanticSearch(@Body() dto: SemanticSearchDto) {
    return this.termsService.semanticSearch(dto);
  }
}
