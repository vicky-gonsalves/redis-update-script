import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, createCluster } from 'redis';

@Injectable()
export class AppService implements OnApplicationShutdown {
  private readonly logger = new Logger();
  private clientConfig;
  private readonly url: string;
  private readonly password: string;
  private static cluster;

  constructor(private readonly configService: ConfigService) {
    this.url = this.configService.get<string>('REDIS_URL');
    this.password = this.configService.get<string>('REDIS_PASS');

    if (this.configService.get<string>('ENV') === 'development') {
      AppService.cluster = createClient({
        url: this.url,
        password: this.password,
      });
    } else {
      AppService.cluster = createCluster({
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
    AppService.cluster.on('error', (err) => {
      this.logger.error('Redis Cluster Error, shutting down application', err);
      process.exit(1);
    });

    AppService.cluster.connect();
  }

  private async fetch(key: string) {
    this.clientConfig = await AppService.cluster.json.get(key);
    this.logger.log('Fetch Client Config From Redis Successful');
    this.logger.log(this.clientConfig);
    if (!this.clientConfig) {
      return new NotFoundException(`key ${key} not found`);
    }
    return this.clientConfig;
  }

  async getKey(key: string) {
    try {
      return this.fetch(key);
    } catch (err) {
      this.logger.error('Fetch Client Config From Redis Failed', err);
      return new UnprocessableEntityException('Fetch Client Config From Redis Failed');
    }
  }

  async updateKey(key: string, value) {
    try {
      await AppService.cluster.json.set(key, '$', value);
    } catch (err) {
      this.logger.error('Update Client Config to Redis Failed', err);
      return new UnprocessableEntityException('Update Client Config to Redis Failed');
    }
    try {
      await AppService.cluster.publish(key, JSON.stringify(value));
    } catch (err) {
      this.logger.error('publish failed', err);
      return new InternalServerErrorException('publish failed');
    }
    return this.fetch(key);
  }

  onApplicationShutdown() {
    AppService.cluster.disconnect();
  }
}
