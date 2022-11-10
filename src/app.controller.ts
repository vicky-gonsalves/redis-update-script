import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('keys')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(':id')
  get(@Param() params) {
    return this.appService.getKey(params.id);
  }

  @Post(':id')
  update(@Param() params, @Body() payload) {
    return this.appService.updateKey(params.id, payload);
  }
}
