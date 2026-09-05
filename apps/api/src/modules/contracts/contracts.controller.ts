import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto, QueryContractsDto } from './dto/contract.dto';
import { RequirePermission, CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @RequirePermission('contracts', 'read')
  @ApiOperation({ summary: 'List contracts, flagging the one applicable to a period' })
  findAll(@Query() query: QueryContractsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('contracts', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.findOne(id, user);
  }

  @Post()
  @RequirePermission('contracts', 'create')
  @ApiOperation({ summary: 'Create a contract; rejects overlapping running contracts' })
  create(@Body() dto: CreateContractDto) {
    return this.contracts.create(dto);
  }

  @Patch(':id')
  @RequirePermission('contracts', 'update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    return this.contracts.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('contracts', 'delete')
  @ApiOperation({ summary: 'Delete, or cancel instead when payslips reference it' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contracts.remove(id);
  }
}
