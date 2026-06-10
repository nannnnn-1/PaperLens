import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId =
      (req.headers["x-request-id"] as string) ||
      `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    (req as unknown as Record<string, string>).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  }
}
