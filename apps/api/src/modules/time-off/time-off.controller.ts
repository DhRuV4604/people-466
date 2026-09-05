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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TimeOffService } from './time-off.service';
import {
  CreateLeaveRequestDto,
  UpdateLeaveRequestDto,
  QueryLeaveRequestsDto,
  CreateAllocationDto,
  UpdateAllocationDto,
  QueryAllocationsDto,
  UpsertTimeOffTypeDto,
  RefuseRequestDto,
} from './dto/time-off.dto';
import { RequirePermission, CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ParseEntityIdPipe } from '../../common/validation/entity-id';

@ApiTags('time-off')
@ApiBearerAuth()
@Controller('time-off')
export class TimeOffController {
  constructor(private readonly timeOff: TimeOffService) {}

  // ---------------------------------------------------------------- Types

  @Get('types')
  @RequirePermission('timeOffTypes', 'read')
  findTypes() {
    return this.timeOff.findTypes();
  }

  @Post('types')
  @RequirePermission('timeOffTypes', 'create')
  createType(@Body() dto: UpsertTimeOffTypeDto) {
    return this.timeOff.createType(dto);
  }

  @Patch('types/:id')
  @RequirePermission('timeOffTypes', 'update')
  updateType(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpsertTimeOffTypeDto) {
    return this.timeOff.updateType(id, dto);
  }

  @Delete('types/:id')
  @RequirePermission('timeOffTypes', 'delete')
  @ApiOperation({ summary: 'Delete, or archive instead when requests reference it' })
  removeType(@Param('id', ParseEntityIdPipe) id: string) {
    return this.timeOff.removeType(id);
  }

  // ---------------------------------------------------------------- Balances

  @Get('balances/:employeeId')
  @RequirePermission('timeOffAllocations', 'read')
  @ApiOperation({ summary: 'Derived balance: approved allocations minus approved requests' })
  balances(
    @Param('employeeId', ParseEntityIdPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    // An employee may only read their own balances.
    const target = user.role === 'EMPLOYEE' ? (user.employeeId ?? employeeId) : employeeId;
    return this.timeOff.getBalances(target);
  }

  // ---------------------------------------------------------------- Allocations

  @Get('allocations')
  @RequirePermission('timeOffAllocations', 'read')
  findAllocations(@Query() query: QueryAllocationsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.findAllocations(query, user);
  }

  @Get('allocations/:id')
  @RequirePermission('timeOffAllocations', 'read')
  findAllocation(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.findAllocation(id, user);
  }

  @Post('allocations')
  @RequirePermission('timeOffAllocations', 'create')
  createAllocation(@Body() dto: CreateAllocationDto) {
    return this.timeOff.createAllocation(dto);
  }

  @Patch('allocations/:id')
  @RequirePermission('timeOffAllocations', 'update')
  updateAllocation(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpdateAllocationDto) {
    return this.timeOff.updateAllocation(id, dto);
  }

  @Post('allocations/:id/approve')
  @RequirePermission('timeOffAllocations', 'approve')
  approveAllocation(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.timeOff.approveAllocation(id, user);
  }

  @Post('allocations/:id/refuse')
  @RequirePermission('timeOffAllocations', 'approve')
  refuseAllocation(@Param('id', ParseEntityIdPipe) id: string) {
    return this.timeOff.refuseAllocation(id);
  }

  @Delete('allocations/:id')
  @RequirePermission('timeOffAllocations', 'delete')
  removeAllocation(@Param('id', ParseEntityIdPipe) id: string) {
    return this.timeOff.removeAllocation(id);
  }

  // ---------------------------------------------------------------- Requests

  @Get('requests')
  @RequirePermission('timeOffRequests', 'read')
  findRequests(@Query() query: QueryLeaveRequestsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.findRequests(query, user);
  }

  @Get('requests/:id')
  @RequirePermission('timeOffRequests', 'read')
  findRequest(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.findRequest(id, user);
  }

  @Post('requests')
  @RequirePermission('timeOffRequests', 'create')
  @ApiOperation({ summary: 'File a request; duration comes from the working schedule' })
  createRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.createRequest(dto, user);
  }

  @Patch('requests/:id')
  @RequirePermission('timeOffRequests', 'update')
  updateRequest(
    @Param('id', ParseEntityIdPipe) id: string,
    @Body() dto: UpdateLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.timeOff.updateRequest(id, dto, user);
  }

  @Post('requests/:id/approve')
  @RequirePermission('timeOffRequests', 'approve')
  @ApiOperation({ summary: 'Approve and draw the duration from a specific allocation' })
  approveRequest(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.approveRequest(id, user);
  }

  @Post('requests/:id/refuse')
  @RequirePermission('timeOffRequests', 'approve')
  refuseRequest(
    @Param('id', ParseEntityIdPipe) id: string,
    @Body() dto: RefuseRequestDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.timeOff.refuseRequest(id, dto, user);
  }

  @Post('requests/:id/cancel')
  @RequirePermission('timeOffRequests', 'read')
  @ApiOperation({ summary: 'Withdraw a request; employees may cancel only their own' })
  cancelRequest(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.timeOff.cancelRequest(id, user);
  }

  @Delete('requests/:id')
  @RequirePermission('timeOffRequests', 'delete')
  removeRequest(@Param('id', ParseEntityIdPipe) id: string) {
    return this.timeOff.removeRequest(id);
  }
}
