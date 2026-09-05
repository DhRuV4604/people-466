import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { SigningService } from './signing.service';

/**
 * Storage and signing.
 *
 * Global because more than one feature stores files - documents now, avatars
 * and the company logo next - and each of those importing it separately would
 * make the storage root look like several things rather than one.
 */
@Global()
@Module({
  providers: [StorageService, SigningService],
  exports: [StorageService, SigningService],
})
export class FilesModule {}
