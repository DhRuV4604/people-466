import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LetterPdfService } from './letter-pdf.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, LetterPdfService],
})
export class DocumentsModule {}
