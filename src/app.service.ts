import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, createCluster } from 'redis';

@Injectable()
export class AppService {
  private readonly logger = new Logger();
  private clientConfig;
  private readonly url: string;
  private readonly password: string;
  private cluster;

  constructor(private readonly configService: ConfigService) {
    this.url = this.configService.get<string>('REDIS_URL');
    this.password = this.configService.get<string>('REDIS_PASS');

    if (this.configService.get<string>('ENV') === 'development') {
      this.cluster = createClient({
        url: this.url,
        password: this.password,
      });
    } else {
      this.cluster = createCluster({
        rootNodes: [
          {
            url: this.url,
          },
        ],
        defaults: {
          password: this.password,
          socket: { tls: true },
        },
      });
    }
    this.cluster.on('error', (err) => {
      this.logger.error('Redis Cluster Error, shutting down application', err);
      process.exit(1);
    });
  }

  private async fetch(key: string) {
    this.clientConfig = await this.cluster.json.get(key);
    this.logger.log('Fetch Client Config From Redis Successful');
    this.logger.log(this.clientConfig);
    if (!this.clientConfig) {
      return new NotFoundException(`key ${key} not found`);
    }
    this.cluster.disconnect();
    return this.clientConfig;
  }

  async getKey(key: string) {
    try {
      await this.cluster.connect();
      return this.fetch(key);
    } catch (err) {
      this.logger.error('Fetch Client Config From Redis Failed', err);
      return new UnprocessableEntityException('Fetch Client Config From Redis Failed');
    }
  }

  async updateKey(key: string, value) {
    try {
      await this.cluster.connect();
      await this.cluster.json.set(key, '$', value);
      return this.fetch(key);
    } catch (err) {
      this.logger.error('Fetch Client Config From Redis Failed', err);
      return new UnprocessableEntityException('Fetch Client Config From Redis Failed');
    }
  }
}
