import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, SelectQueryBuilder } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { NoteResourceType } from './enums';
import NoteEntity from './note.entity';

export type CreateNoteInput = Pick<
  NoteEntity,
  | 'projectId'
  | 'authorUserId'
  | 'resourceType'
  | 'resourceId'
  | 'content'
  | 'isShared'
>;

export type UpdateNoteInput = Partial<
  Pick<NoteEntity, 'content' | 'isShared' | 'isPinned'>
>;

export interface QueryNotesByResourceInput {
  projectId: number;
  resourceType: NoteResourceType;
  resourceId: string;
  isPinned?: boolean;
  isShared?: boolean;
  page?: number;
  keyword?: string;
  limit?: number;
}

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

    const note = this.noteRepository.create({
      projectId,
      resourceType,
      resourceId,
      isPinned: false,
    });
    this.logger.log({ log: 'Got note draft for list by resource', note });

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

  async listByProject(projectId: number): Promise<NoteEntity[]> {
    this.logger.log({
      log: 'Attempting to list notes by project',
      projectId,
    });

    const result = await this.noteRepository.find({
      where: { projectId },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
    });

    this.logger.log({
      log: 'Got notes by project result',
      projectId,
      count: result.length,
      noteIds: result.map(({ id }) => id),
    });

    return result;
  }

  async deleteNote(noteId: number, userId: string): Promise<void> {
    this.logger.log({ log: 'Attempting to delete note', noteId });

    const note = await this.noteRepository.findOne({ where: { id: noteId } });
    if (!note) {
      throw new Error('Note not found');
    }
    if (note.authorUserId !== userId) {
      throw new Error('Permission denied');
    }

    await this.noteRepository.softDelete({ id: noteId });

    this.logger.log({ log: 'Note deleted', noteId });
  }

  async getNoteById(noteId: number): Promise<NoteEntity | null> {
    this.logger.log({ log: 'Attempting to get note by id', noteId });

    const result = await this.noteRepository.findOne({
      where: { id: noteId },
    });

    this.logger.log({
      log: 'Got note by id result',
      noteId,
      found: !!result,
      note: result,
    });

    return result;
  }

  async pinNote(
    noteId: number,
    userId: string,
    isPinned: boolean,
  ): Promise<NoteEntity> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId },
    });

    if (note?.authorUserId !== userId) {
      throw new Error('Permission denied');
    }
    if (!note) {
      throw new Error('Note not found');
    }

    note.isPinned = isPinned;

    return this.noteRepository.save(note);
  }

  async updateNote(
    noteId: number,
    userId: string,
    input: UpdateNoteInput,
  ): Promise<NoteEntity> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId },
    });
    if (!note) {
      throw new Error('Note not found');
    }

    if (note.authorUserId !== userId) {
      throw new Error('Permission denied');
    }
    if (input.content !== undefined) {
      note.content = input.content;
    }
    Object.assign(note, input);

    return await this.noteRepository.save(note);
  }

  async listByResourceWithPagination(
    input: QueryNotesByResourceInput,
  ): Promise<{ notes: NoteEntity[]; total: number }> {
    const {
      projectId,
      resourceType,
      resourceId,
      isPinned,
      isShared,
      page = 1,
      keyword,
      limit = 20,
    } = input;

    const [result, total] = await this.noteRepository.findAndCount({
      where: {
        projectId,
        resourceType,
        resourceId,
        isPinned,
        isShared,
        content: keyword ? Like(`%${keyword}%`) : undefined,
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { notes: result, total };
  }

  async shareNote(
    noteId: number,
    userId: string,
    isShared: boolean,
  ): Promise<NoteEntity> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId },
    });

    if (note?.authorUserId !== userId) {
      throw new Error('Permission denied');
    }
    if (!note) {
      throw new Error('Note not found');
    }

    note.isShared = isShared;

    return this.noteRepository.save(note);
  }

  async queryNote(
    query: QueryNotesByResourceInput,
  ): Promise<{ notes: NoteEntity[]; total: number }> {
    const {
      projectId,
      resourceType,
      resourceId,
      isPinned,
      isShared,
      page = 1,
      keyword,
      limit = 20,
    } = query;

    const db: SelectQueryBuilder<NoteEntity> = this.noteRepository
      .createQueryBuilder('note')
      .where('note.projectId = :projectId', { projectId })
      .andWhere('note.resourceType = :resourceType', { resourceType })
      .andWhere('note.resourceId = :resourceId', { resourceId });

    if (isPinned !== undefined) {
      db.andWhere('note.isPinned = :isPinned', { isPinned });
    }

    if (isShared !== undefined) {
      db.andWhere('note.isShared = :isShared', { isShared });
    }

    if (keyword) {
      db.andWhere('note.content ILIKE :keyword', { keyword: `%${keyword}%` });
    }

    db.orderBy('note.createdAt', 'DESC')
      .addOrderBy('note.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [result, total] = await db.getManyAndCount();

    return { notes: result, total };
  }
}
