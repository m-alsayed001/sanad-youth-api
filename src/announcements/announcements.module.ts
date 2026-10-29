import { Module } from '@nestjs/common';
import { ProgramsModule } from '../programs/programs.module.js';
import { AnnouncementsController } from './announcements.controller.js';
import { AnnouncementsService } from './announcements.service.js';

@Module({
  imports: [ProgramsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
