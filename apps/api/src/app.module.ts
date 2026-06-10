import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { RedisModule } from "./config/redis.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { FilesModule } from "./files/files.module";
import { PapersModule } from "./papers/papers.module";
import { ReadingModule } from "./reading/reading.module";
import { ChatModule } from "./chat/chat.module";
import { TermsModule } from "./terms/terms.module";
import { AiGatewayModule } from "./ai-gateway/ai-gateway.module";
import { ParseModule } from "./parse/parse.module";
import { SseModule } from "./sse/sse.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    FilesModule,
    PapersModule,
    ReadingModule,
    ChatModule,
    TermsModule,
    AiGatewayModule,
    ParseModule,
    SseModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
