import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dtos/create-user.dto';
import { GetManyUsersDto } from './dtos/get-many-user.dto';
import { UserStatus } from './enum/user-status.enum';
import { UserService } from './user.service';

@Controller('users')
@ApiTags('Users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    const { mezonId, ...meta } = body;
    return this.userService.upsertByMezonId(mezonId, meta);
  }
  @Get('list')
  async getManyUsers(@Query() query: GetManyUsersDto) {
    return this.userService.getManyByIdsAndUsernames({
      ids: query.ids,
      mezonIds: query.mezonIds,
    });
  }
  @Get('search/:identifier')
  async findUserByIdentifier(@Param('identifier') identifier: string) {
    return this.userService.findByIdentifier(identifier, true);
  }

  @Get('id/:id')
  async getUserById(@Param('id') id: string) {
    return this.userService.findById(id);
  }
  @Patch('restore/:identifier')
  async restoreUser(@Param('identifier') identifier: string) {
    return this.userService.restoreUser(identifier);
  }
  @Patch('status/:identifier')
  async updateStatusUser(
    @Param('identifier') identifier: string,
    @Body('status') status: UserStatus,
  ) {
    return this.userService.updateStatusUser(identifier, status);
  }
  @Delete(':identifier')
  async softDeleteUser(@Param('identifier') identifier: string) {
    return this.userService.softDeleteUser(identifier);
  }
}
