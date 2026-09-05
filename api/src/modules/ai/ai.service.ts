import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DraftRequest {
  kind: string;
  employee: Record<string, unknown>;
  company: Record<string, unknown>;
  notes?: string;
}

export interface DraftResult {
  title: string;
  body: string;
  costUsd: number | null;
}

export interface ExtractResult {
  title: string;
  kind: string;
  personName: string | null;
  needsSignature: boolean;
  summary: string;
  costUsd: number | null;
}

/**
 * Talks to the AI bridge.
 *
 * The bridge runs the Claude CLI on the host, because the CLI is signed in as
 * a person rather than holding an API key and there is nothing for a container
 * to authenticate with. So this is an HTTP client rather than a model client,
 * and the interesting part is what it does when the bridge is not there: it
 * says so plainly, because "AI is not set up on this install" and "the model
 * refused" need different answers from whoever is looking at the screen.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ai.bridgeUrl')?.trim());
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    const base = this.config.get<string>('ai.bridgeUrl')?.trim();
    if (!base) {
      throw new ServiceUnavailableException(
        'Writing with AI is not set up on this install. Start the bridge and set AI_BRIDGE_URL.'
      );
    }

    const token = this.config.get<string>('ai.bridgeToken')?.trim();
    let response: Response;
    try {
      response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { 'x-bridge-token': token } : {}),
        },
        body: JSON.stringify(body),
        // Generating a letter takes ten seconds or so; reading a long document
        // takes longer. The bridge has its own timeout under this one.
        signal: AbortSignal.timeout(
          this.config.get<number>('ai.timeoutMs') ?? 150_000
        ),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`AI bridge unreachable: ${reason}`);
      throw new ServiceUnavailableException(
        'The AI bridge did not answer. Check that it is running on the host.'
      );
    }

    const payload = (await response.json().catch(() => null)) as
      | (T & { message?: string })
      | null;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload?.message ?? 'The AI bridge could not complete that.'
      );
    }

    return payload as T;
  }

  draft(request: DraftRequest): Promise<DraftResult> {
    return this.call<DraftResult>('/draft', request);
  }

  extract(text: string): Promise<ExtractResult> {
    return this.call<ExtractResult>('/extract', { text });
  }
}
