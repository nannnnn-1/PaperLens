import { Module } from "@nestjs/common";
import { PapersService } from "./papers.service";
import { PapersController } from "./papers.controller";
import { FilesModule } from "../files/files.module";
import { AiGatewayModule } from "../ai-gateway/ai-gateway.module";

@Module({
  imports: [FilesModule, AiGatewayModule],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
