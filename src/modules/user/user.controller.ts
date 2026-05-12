import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './dtos/create-user.dto';
import { GetManyUsersDto } from './dtos/get-many-user.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { UserStatus } from './enum/user-status.enum';
import { UserService } from './user.service';

import { JwtAuthGuard } from '@src/modules/auth/guards/jwt-auth.guard';

@Controller('users')
@ApiTags('Users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update a user by Mezon ID' })
  async createUser(@Body() body: CreateUserDto): Promise<UserResponseDto> {
    const { mezonId, ...meta } = body;
    const user = await this.userService.upsertByMezonId(mezonId, meta);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get('list')
  @ApiOperation({ summary: 'Get multiple users by their IDs or Mezon IDs' })
  async getManyUsers(
    @Query() query: GetManyUsersDto,
  ): Promise<UserResponseDto[]> {
    const users = await this.userService.getManyByIdsAndUsernames({
      ids: query.ids,
      mezonIds: query.mezonIds,
    });
    return plainToInstance(UserResponseDto, users, {
      excludeExtraneousValues: true,
    });
  }

  @Get('search/:identifier')
  @ApiOperation({ summary: 'Find a user by ID or Mezon ID' })
  async findUserByIdentifier(
    @Param('identifier') identifier: string,
  ): Promise<UserResponseDto | null> {
    const user = await this.userService.findByIdentifier(identifier, true);
    return user
      ? plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        })
      : null;
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Get a user by their unique UUID' })
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto | null> {
    const user = await this.userService.findById(id);
    return user
      ? plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        })
      : null;
  }

  @Patch('restore/:identifier')
  @HttpCode(204)
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  async restoreUser(@Param('identifier') identifier: string): Promise<void> {
    await this.userService.restoreUser(identifier);
  }

  @Patch('status/:identifier')
  @HttpCode(204)
  @ApiOperation({ summary: "Update a user's status (e.g., ACTIVE, INACTIVE)" })
  async updateStatusUser(
    @Param('identifier') identifier: string,
    @Body('status', new ParseEnumPipe(UserStatus)) status: UserStatus,
  ): Promise<void> {
    await this.userService.updateStatusUser(identifier, status);
  }

  @Delete(':identifier')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete a user' })
  async softDeleteUser(@Param('identifier') identifier: string): Promise<void> {
    await this.userService.softDeleteUser(identifier);
  }
}
