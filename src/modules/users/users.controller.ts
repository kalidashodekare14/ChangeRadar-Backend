import { Body, Controller, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user’s name' })
  update(@CurrentUser() user: CurrentUserData, @Body() dto: UpdateProfileDto): Promise<PublicUser> {
    return this.users.updateName(user.id, dto.name);
  }

  @Post('me/password')
  @ApiOperation({ summary: 'Change the password and revoke other sessions' })
  changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    return this.users.changePassword(user.id, user.sessionId, dto.currentPassword, dto.newPassword);
  }
}
