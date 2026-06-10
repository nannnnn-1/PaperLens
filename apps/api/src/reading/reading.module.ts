import { Module } from "@nestjs/common";
import { ReadingService } from "./reading.service";
import { ReadingController } from "./reading.controller";
import { FilesModule } from "../files/files.module";
import { AiGatewayModule } from "../ai-gateway/ai-gateway.module";

@Module({
  imports: [FilesModule, AiGatewayModule],
  controllers: [ReadingController],
  providers: [ReadingService],
  exports: [ReadingService],
})
export class ReadingModule {}
