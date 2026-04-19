import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { NoteResourceType } from './enums';
import NoteEntity from './note.entity';

export type CreateNoteInput = Pick<
  NoteEntity,
  'projectId' | 'authorUserId' | 'resourceType' | 'resourceId' | 'content'
>;

@Injectable()
export class NoteService extends CRUDService<NoteEntity> {
  private readonly logger = new Logger(NoteService.name);

  constructor(
    @InjectRepository(NoteEntity)
    private noteRepository: Repository<NoteEntity>,
  ) {
    super(noteRepository);
  }

  async createNote(input: CreateNoteInput): Promise<NoteEntity> {
    this.logger.log({ log: 'Attempting to create note', input });
    const note = this.noteRepository.create(input);
    this.logger.log({ log: 'Got note draft for creation', note });

    const result = await this.noteRepository.save(note);
    this.logger.log({ log: 'Note create result', result });

    return result;
  }

  async listByResource(
    projectId: number,
    resourceType: NoteResourceType,
    resourceId: string,
  ): Promise<NoteEntity[]> {
    this.logger.log({
      log: 'Attempting to list notes by resource',
      projectId,
      resourceType,
      resourceId,
    });

    const result = await this.noteRepository.find({
      where: {
        projectId,
        resourceType,
        resourceId,
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
    });

    this.logger.log({
      log: 'Got notes by resource result',
      projectId,
      resourceType,
      resourceId,
      count: result.length,
      noteIds: result.map(({ id }) => id),
    });

    return result;
  }
}
