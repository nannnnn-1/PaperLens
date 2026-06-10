import { Module } from "@nestjs/common";
import { TermsService } from "./terms.service";
import { TermsController } from "./terms.controller";
import { AiGatewayModule } from "../ai-gateway/ai-gateway.module";

@Module({
  imports: [AiGatewayModule],
  controllers: [TermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}
