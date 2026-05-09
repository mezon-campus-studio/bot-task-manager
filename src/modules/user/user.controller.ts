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
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './dtos/create-user.dto';
import { GetManyUsersDto } from './dtos/get-many-user.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { UserStatus } from './enum/user-status.enum';
import { UserService } from './user.service';

@Controller('users')
@ApiTags('Users')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() body: CreateUserDto): Promise<UserResponseDto> {
    const { mezonId, ...meta } = body;
    const user = await this.userService.upsertByMezonId(mezonId, meta);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get('list')
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
  async restoreUser(@Param('identifier') identifier: string): Promise<void> {
    await this.userService.restoreUser(identifier);
  }

  @Patch('status/:identifier')
  @HttpCode(204)
  async updateStatusUser(
    @Param('identifier') identifier: string,
    @Body('status', new ParseEnumPipe(UserStatus)) status: UserStatus,
  ): Promise<void> {
    await this.userService.updateStatusUser(identifier, status);
  }

  @Delete(':identifier')
  @HttpCode(204)
  async softDeleteUser(@Param('identifier') identifier: string): Promise<void> {
    await this.userService.softDeleteUser(identifier);
  }
}
