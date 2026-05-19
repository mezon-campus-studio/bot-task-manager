import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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

export interface NoteListFilter {
  callerId: string;
  isManager: boolean;
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

  private applyListFilter(
    qb: SelectQueryBuilder<NoteEntity>,
    filter: NoteListFilter,
  ): void {
    const { callerId, isManager } = filter;

    if (isManager) {
      qb.andWhere(
        `(
        note.authorUserId = :callerId
        OR note.resourceType != :userType
        OR (note.resourceType = :userType AND note.isShared = true)
      )`,
        { callerId, userType: NoteResourceType.USER },
      );
    } else {
      qb.andWhere(
        `(
        note.authorUserId = :callerId
        OR (
          note.resourceType != :userType
          AND note.isShared = true
        )
        OR (note.resourceType = :userType AND note.isShared = true)
      )`,
        { callerId, userType: NoteResourceType.USER },
      );
    }
  }

  async createNote(input: CreateNoteInput): Promise<NoteEntity> {
    this.logger.log({ log: 'createNote', input });
    const note = this.noteRepository.create(input);
    const result = await this.noteRepository.save(note);
    this.logger.log({ log: 'Note created', noteId: result.id });
    return result;
  }

  async listByResource(
    projectId: number,
    resourceType: NoteResourceType,
    resourceId: string,
    filter: NoteListFilter,
  ): Promise<NoteEntity[]> {
    this.logger.log({
      log: 'listByResource',
      projectId,
      resourceType,
      resourceId,
    });

    const qb = this.noteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.authorUser', 'authorUser')
      .where('note.projectId = :projectId', { projectId })
      .andWhere('note.resourceType = :resourceType', { resourceType })
      .andWhere('note.resourceId = :resourceId', { resourceId });

    this.applyListFilter(qb, filter);

    return qb
      .orderBy('note.createdAt', 'DESC')
      .addOrderBy('note.id', 'DESC')
      .getMany();
  }

  async listByProject(
    projectId: number,
    filter: NoteListFilter,
  ): Promise<NoteEntity[]> {
    this.logger.log({ log: 'listByProject', projectId });

    const qb = this.noteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.authorUser', 'authorUser')
      .where('note.projectId = :projectId', { projectId });

    this.applyListFilter(qb, filter);

    return qb
      .orderBy('note.createdAt', 'DESC')
      .addOrderBy('note.id', 'DESC')
      .getMany();
  }

  async getNoteById(noteId: number): Promise<NoteEntity | null> {
    this.logger.log({ log: 'getNoteById', noteId });

    return this.noteRepository.findOne({
      where: { id: noteId },
      relations: ['authorUser'],
    });
  }

  async updateNote(
    noteId: number,
    input: UpdateNoteInput,
  ): Promise<NoteEntity | null> {
    const note = await this.noteRepository.findOne({ where: { id: noteId } });
    if (!note) return null;

    Object.assign(note, input);
    return this.noteRepository.save(note);
  }

  async deleteNote(noteId: number): Promise<void> {
    this.logger.log({ log: 'deleteNote', noteId });
    await this.noteRepository.softDelete({ id: noteId });
  }

  async pinNote(noteId: number, isPinned: boolean): Promise<NoteEntity | null> {
    const note = await this.noteRepository.findOne({ where: { id: noteId } });
    if (!note) return null;

    note.isPinned = isPinned;
    return this.noteRepository.save(note);
  }

  async shareNote(
    noteId: number,
    isShared: boolean,
  ): Promise<NoteEntity | null> {
    const note = await this.noteRepository.findOne({ where: { id: noteId } });
    if (!note) return null;

    note.isShared = isShared;
    return this.noteRepository.save(note);
  }

  async queryNote(
    query: QueryNotesByResourceInput,
    filter: NoteListFilter,
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

    const qb: SelectQueryBuilder<NoteEntity> = this.noteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.authorUser', 'authorUser')
      .where('note.projectId = :projectId', { projectId })
      .andWhere('note.resourceType = :resourceType', { resourceType })
      .andWhere('note.resourceId = :resourceId', { resourceId });

    this.applyListFilter(qb, filter);

    if (isPinned !== undefined) {
      qb.andWhere('note.isPinned = :isPinned', { isPinned });
    }
    if (isShared !== undefined) {
      qb.andWhere('note.isShared = :isShared', { isShared });
    }
    if (keyword) {
      qb.andWhere('note.content ILIKE :keyword', { keyword: `%${keyword}%` });
    }

    qb.orderBy('note.createdAt', 'DESC')
      .addOrderBy('note.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [result, total] = await qb.getManyAndCount();
    return { notes: result, total };
  }
}
