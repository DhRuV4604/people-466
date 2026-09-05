import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/company.dto';
import { CurrentUser, RequirePermission } from '../../common/decorators';
import { StorageService, type UploadedFile as StoredUpload } from '../files/storage.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('company')
@ApiBearerAuth()
@Controller('company')
export class CompanyController {
  constructor(
    private readonly company: CompanyService,
    private readonly storage: StorageService
  ) {}

  /**
   * Readable by anyone signed in.
   *
   * Not a permission, because the company's own name is on the payslip of the
   * person reading it, and gating it behind an admin grant would mean the
   * header of their payslip could not render.
   */
  @Get()
  @ApiOperation({ summary: 'Company name, address and branding' })
  get() {
    return this.company.get();
  }

  @Get('logo')
  @ApiOperation({ summary: 'The logo image, or 404 when none is set' })
  async logo(@Res() response: Response) {
    const { logoFileId } = await this.company.get();
    if (!logoFileId) {
      response.status(404).json({ message: 'No logo has been set.' });
      return;
    }

    const file = await this.storage.read(logoFileId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.size);
    // Immutable: a new logo is a new file with a new id, so this can be held
    // for as long as the browser likes.
    response.setHeader('Cache-Control', 'private, max-age=3600');
    file.stream.pipe(response);
  }

  // Changing who the company says it is belongs with the rest of the
  // organisation-wide settings, which is what this grant guards.
  @Patch()
  @RequirePermission('workingSchedules', 'update')
  update(@Body() dto: UpdateCompanyDto) {
    return this.company.update(dto);
  }

  @Post('logo')
  @RequirePermission('workingSchedules', 'update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  setLogo(
    @UploadedFile() file: StoredUpload | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.company.setLogo(file, user.userId);
  }

  @Delete('logo')
  @RequirePermission('workingSchedules', 'update')
  removeLogo() {
    return this.company.removeLogo();
  }
}
