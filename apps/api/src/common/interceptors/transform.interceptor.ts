import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Response } from "express";
import { Reflector } from "@nestjs/core";
import { SKIP_TRANSFORM_KEY } from "../decorators/skip-transform.decorator";

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
  requestId: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest();
    const requestId = request.requestId ?? "unknown";

    return next.handle().pipe(
      map((data) => ({
        code:
          response.statusCode >= 200 && response.statusCode < 300
            ? response.statusCode
            : 200,
        data: data ?? null,
        message: "success",
        requestId,
      })),
    );
  }
}
