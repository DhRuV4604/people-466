import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DocumentsService } from './documents.service';
import {
  CreateDocumentDto,
  DeclineDocumentDto,
  DraftDocumentDto,
  QueryDocumentsDto,
  RequestDocumentDto,
  SignDocumentDto,
} from './dto/document.dto';
import { CurrentUser, RequirePermission } from '../../common/decorators';
import { ParseEntityIdPipe } from '../../common/validation/entity-id';
import { StorageService, type UploadedFile as StoredUpload } from '../files/storage.service';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * The proxy is not in front of this in development, so the socket address is
 * the honest answer more often than the header is. The header wins where it
 * exists because behind a proxy the socket only ever says "the proxy".
 */
function clientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (first ?? request.socket.remoteAddress ?? '').trim().slice(0, 60);
}

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly storage: StorageService
  ) {}

  @Get()
  @RequirePermission('documents', 'read')
  @ApiOperation({ summary: 'List documents; an employee sees only their own' })
  findAll(@Query() query: QueryDocumentsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('documents', 'read')
  findOne(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documents.findOne(id, user);
  }

  @Get(':id/signature')
  @RequirePermission('documents', 'read')
  @ApiOperation({ summary: 'Who signed it, when, and from where' })
  signature(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documents.signature(id, user);
  }

  /**
   * The bytes.
   *
   * Streamed through the API rather than served from a static directory: the
   * only thing standing between someone's passport scan and the internet is
   * this permission check, and a static mount has none.
   */
  @Get(':id/file')
  @RequirePermission('documents', 'read')
  async download(
    @Param('id', ParseEntityIdPipe) id: string,
    @Query('version') version: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    const fileId = await this.documents.fileFor(
      id,
      user,
      version === 'original' ? 'original' : 'signed'
    );
    const file = await this.storage.read(fileId);

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.size);
    // inline, so a PDF opens in the viewer instead of landing in Downloads.
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.filename)}"`
    );
    file.stream.pipe(response);
  }

  @Post()
  @RequirePermission('documents', 'create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document into an employee file' })
  // Held in memory rather than written to a temp directory: StorageService
  // decides the name and location, and a file on disk before it has been
  // checked is a file that can be left behind.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: StoredUpload | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documents.create(dto, file, user);
  }

  /**
   * Writes one with the model. Lands as a draft: see the service for why.
   */
  @Post('draft')
  @RequirePermission('documents', 'create')
  @ApiOperation({ summary: 'Write a document with AI and file it as a draft' })
  draft(@Body() dto: DraftDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.draft(dto, user);
  }

  /**
   * Reads an upload and suggests how to file it. Creates nothing: the answer
   * fills in the form and a person confirms it.
   */
  @Post('analyse')
  @RequirePermission('documents', 'create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Read a PDF and suggest a title, type and signer' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  analyse(@UploadedFile() file: StoredUpload | undefined) {
    return this.documents.analyse(file);
  }

  @Post('request')
  @RequirePermission('documents', 'create')
  @ApiOperation({ summary: 'Ask an employee to supply a document' })
  request(@Body() dto: RequestDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.request(dto, user);
  }

  /**
   * Answering a request, signing and declining are the three things an
   * employee may do, and each is guarded by the record rather than the matrix:
   * what makes them allowed is that this document was sent to this person.
   *
   * `read` is deliberately the grant they carry. A create grant would apply to
   * every document rather than one, and the endpoints above would then accept
   * an employee filing paperwork into a colleague's record.
   */
  @Post(':id/submit')
  @RequirePermission('documents', 'read')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  submit(
    @Param('id', ParseEntityIdPipe) id: string,
    @UploadedFile() file: StoredUpload | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documents.submit(id, file, user);
  }

  @Post(':id/sign')
  @RequirePermission('documents', 'read')
  @ApiOperation({ summary: 'Sign a document addressed to you' })
  sign(
    @Param('id', ParseEntityIdPipe) id: string,
    @Body() dto: SignDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ) {
    return this.documents.sign(id, dto, user, {
      ip: clientIp(request),
      userAgent: String(request.headers['user-agent'] ?? ''),
    });
  }

  @Post(':id/decline')
  @RequirePermission('documents', 'read')
  decline(
    @Param('id', ParseEntityIdPipe) id: string,
    @Body() dto: DeclineDocumentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documents.decline(id, dto, user);
  }

  @Post(':id/send')
  @RequirePermission('documents', 'update')
  @ApiOperation({ summary: 'Send a draft to the employee' })
  send(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documents.send(id, user);
  }

  @Post(':id/cancel')
  @RequirePermission('documents', 'update')
  @ApiOperation({ summary: 'Withdraw a document that has not been signed' })
  cancel(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documents.cancel(id, user);
  }
}
