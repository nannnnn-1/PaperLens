import { Controller, Post, Body, UseGuards, Sse } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { ChatService } from "./chat.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  RequestUser,
} from "../common/decorators/current-user.decorator";
import { ChatPaperDto } from "./dto/chat-paper.dto";
import { SkipTransform } from "../common/decorators/skip-transform.decorator";

interface ChatMessageEvent {
  event: string;
  data: string;
}

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("paper")
  async chatPaper(@CurrentUser() user: RequestUser, @Body() dto: ChatPaperDto) {
    const result = await this.chatService.chatPaper(user.userId, dto);
    return result;
  }

  @Post("paper/stream")
  @Sse()
  @SkipTransform()
  async chatPaperStream(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChatPaperDto,
  ): Promise<Observable<ChatMessageEvent>> {
    const result = await this.chatService.chatPaper(user.userId, {
      ...dto,
      stream: false,
    });
    const sessionId = result.sessionId;
    const reply = result.reply;

    return of(
      {
        event: "chat:delta",
        data: JSON.stringify({ sessionId, delta: reply, finish: false }),
      },
      {
        event: "chat:done",
        data: JSON.stringify({ sessionId, finish: true }),
      },
    );
  }
}
