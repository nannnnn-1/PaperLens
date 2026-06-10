import { Controller, Get, UseGuards, Sse } from "@nestjs/common";
import { interval, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SkipTransform } from "../common/decorators/skip-transform.decorator";

interface SseMessage {
  event: string;
  data: string;
}

@Controller("sse")
export class SseController {
  @Get("connect")
  @Sse()
  @SkipTransform()
  @UseGuards(JwtAuthGuard)
  connect(): Observable<SseMessage> {
    return interval(30000).pipe(
      map(() => ({
        event: "heartbeat",
        data: JSON.stringify({ ts: new Date().toISOString() }),
      })),
    );
  }
}
