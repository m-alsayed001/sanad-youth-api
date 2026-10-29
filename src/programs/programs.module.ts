import { Module } from '@nestjs/common';
import { MaterialsService } from './materials.service.js';
import { ProgramsController } from './programs.controller.js';
import { ProgramsService } from './programs.service.js';
import { SessionsService } from './sessions.service.js';

@Module({
  controllers: [ProgramsController],
  providers: [ProgramsService, SessionsService, MaterialsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
