import { Module } from '@nestjs/common';
import { ConfigDataModule } from '../config/config-data.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LetterPdfService } from './letter-pdf.service';

@Module({
  imports: [ConfigDataModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, LetterPdfService],
})
export class DocumentsModule {}
