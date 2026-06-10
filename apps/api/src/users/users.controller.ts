import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  RequestUser,
} from "../common/decorators/current-user.decorator";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AddInterestDto } from "./dto/add-interest.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Get("me/interests")
  interests(@CurrentUser() user: RequestUser) {
    return this.usersService.getInterests(user.userId);
  }

  @Post("me/interests")
  addInterest(@CurrentUser() user: RequestUser, @Body() dto: AddInterestDto) {
    return this.usersService.addInterest(user.userId, dto);
  }

  @Delete("me/interests/:id")
  removeInterest(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.usersService.removeInterest(user.userId, id);
  }

  @Get("me/settings")
  settings(@CurrentUser() user: RequestUser) {
    return this.usersService.getSettings(user.userId);
  }

  @Patch("me/settings")
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.userId, dto);
  }

  @Get("me/stats")
  stats(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.usersService.getStats(user.userId, from, to);
  }
}
