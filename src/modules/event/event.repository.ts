import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import EventEntity from './event.entity';
import { GetEventQueryDto } from './dto';


@Injectable()
export class EventRepository extends Repository<EventEntity> {
  constructor(dataSource: DataSource) {
    super(EventEntity, dataSource.createEntityManager());
  }


  /**
   * Truy vấn danh sách có Filter Type và Date Range
   */
  async findEvents(query: GetEventQueryDto): Promise<{ data: EventEntity[], total: number }> {
  // 1. Lấy dữ liệu từ query, gán mặc định cho page và limit
  const { projectId, type, fromDate, toDate, status, page = 1, limit = 5 } = query;
  
  const qb = this.createQueryBuilder('event');

  // 2. Filter logic
  qb.where('event.projectId = :projectId', { projectId });
  if (type) qb.andWhere('event.type = :type', { type });
  if (status) qb.andWhere('event.status = :status', { status });

  // Date Range logic
  if (fromDate && toDate) {
    qb.andWhere('event.startsAt BETWEEN :fromDate AND :toDate', { fromDate, toDate });
  } else if (fromDate) {
    qb.andWhere('event.startsAt >= :fromDate', { fromDate });
  } else if (toDate) {
    qb.andWhere('event.startsAt <= :toDate', { toDate });
  }

  // 3. Pagination logic
  const skip = (page - 1) * limit;

  qb.orderBy('event.startsAt', 'ASC')
    .skip(skip)
    .take(limit);

  // 4. Thực thi truy vấn
  // Sử dụng getManyAndCount để lấy cả danh sách và tổng số lượng
  const [data, total] = await qb.getManyAndCount();

  return {
    data,
    total
  };
}

  async createEvent(data: Partial<EventEntity>): Promise<EventEntity> {
    const event = this.create(data); // Tạo instance
    return await this.save(event);    // Lưu vào DB
  }
  /**
   * Lấy chi tiết kèm Scope để bảo mật
   */
  async findOneWithScope(id: string, projectId: string): Promise<EventEntity | null> {
    return await this.findOne({
      where: { id: id as any, projectId: projectId as any }
    });
  }
  
}