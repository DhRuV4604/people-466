import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';

/** Global, like storage: several features will want it and there is one bridge. */
@Global()
@Module({ providers: [AiService], exports: [AiService] })
export class AiModule {}
