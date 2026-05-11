import { Injectable, Logger } from '@nestjs/common';

import { GetEventQueryDto } from './dto/get-event-query.dto';
import { CRUDService } from '@src/common/utils/crud';
import { EventStatus } from './enums';
import { EventRepository } from './event.repository'; // Nhớ import cái này
import EventEntity from './event.entity';
import { UpdateEventDto } from './dto/update-event.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

export type CreateEventInput = Pick<
  EventEntity,
  | 'projectId'
  | 'teamId'
  | 'ownerUserId'
  | 'title'
  | 'description'
  | 'status'
  | 'startsAt'
  | 'endsAt'
  | 'location'
  | 'reminder'
>;

@Injectable()
export class EventService extends CRUDService<EventEntity> {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private readonly eventRepo: EventRepository, // Sử dụng repository đã tạo
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    super(eventRepo);
  }

  private calculateReminderTime(startTime: Date, offsetMinutes: number): Date {
    return new Date(startTime.getTime() - offsetMinutes * 60 * 1000);
  }

    private validateEventPolicy(startsAt: Date, endsAt: Date, reminder?: number) {
    if (endsAt <= startsAt) {
      throw new BadRequestException('Thời gian kết thúc phải sau bắt đầu');
    }
    if (reminder && reminder > 10080) { // Ví dụ: không quá 7 ngày
      throw new BadRequestException('Reminder offset quá lớn');
    }
  }

  async findEvents(query: GetEventQueryDto): Promise<EventEntity[]> {
    this.logger.log({ log: 'Service: Fetching filtered events', query });
    
    // Gọi đến hàm findEvents mà bạn đã viết trong file event.repository.ts
    return this.eventRepo.findEvents(query).then(result => {
      this.logger.log({ log: 'Service: Fetched events with filters', count: result.data.length, total: result.total });
      return result.data; // Chỉ trả về danh sách sự kiện, không cần total ở đây
    });
  }

  

 async createEvent(dto: CreateEventInput): Promise<EventEntity> {
    this.logger.log({ log: 'Attempting to create event', dto });

    const result = await this.eventRepo.createEvent(dto);
    // FIX LỖI: Chuyển logic validate và tính toán lên TRƯỚC khi save/return
    const { startsAt, endsAt, reminder } = dto;
    
    // Xử lý giá trị null/undefined để tránh lỗi Overload
    const start = startsAt ? new Date(startsAt) : new Date();
    const end = endsAt ? new Date(endsAt) : new Date();
    const offset = reminder ?? 0;

    this.scheduleReminder(result.id, this.calculateReminderTime(start, offset));
    // 1. Validate policy
    this.validateEventPolicy(start, end, offset);
    // 2. Tính toán thời gian reminder (Nếu cần lưu vào DB thì gán vào dto)
    const reminderTime = this.calculateReminderTime(start, offset);
    this.logger.log({ log: 'Calculated reminder time', reminderTime });
    this.scheduleReminder(result.id, reminderTime);
    // 3. Thực hiện lưu vào database
    this.logger.log({ log: 'Event creation result', eventId: result.id });
    return result;
  }


  async listByProject(projectId: number): Promise<EventEntity[]> {
    this.logger.log({ log: 'Attempting to list events by project', projectId });

    const result = await this.eventRepo.find({
      where: { projectId },
      order: {
        startsAt: 'ASC',
        id: 'DESC',
      },
    });

    this.logger.log({
      log: 'Got events by project result',
      projectId,
      count: result.length,
      eventIds: result.map(({ id }) => id),
    });

    return result;
  }

  async cancelEvent(eventId: number): Promise<EventEntity | null> {
    this.logger.log({ log: 'Attempting to cancel event', eventId });

    const event = await this.eventRepo.findOne({
      where: { id: eventId },
    });

    this.logger.log({ log: 'Got event for cancellation', eventId, event });

    if (!event) {
      this.logger.log({ log: 'Event not found for cancellation', eventId });
      return null;
    }

    event.status = EventStatus.CANCELLED;

    const result = await this.eventRepo.save(event);
    this.logger.log({ log: 'Event cancellation result', eventId, result });

    return result;
  }

  async updateEvent(id: string, projectId: string, dto: UpdateEventDto): Promise<EventEntity> {
    this.logger.log({ log: 'Attempting to update event', id, projectId, dto });

    const event = await this.eventRepo.findOne({
      where: { id: id as any, projectId: projectId as any },
    });

    if (!event) {
      throw new NotFoundException('Event not found or project mismatch');
    }

    // Tận dụng hàm validateEventPolicy đã viết
    const finalStart = dto.startsAt ? new Date(dto.startsAt) : (event.startsAt ? new Date(event.startsAt) : new Date());
    const finalEnd = dto.endsAt ? new Date(dto.endsAt) : (event.endsAt ? new Date(event.endsAt) : new Date());
    const finalReminder = dto.reminder ?? event.reminder;

    this.validateEventPolicy(finalStart, finalEnd, finalReminder);

    Object.assign(event, dto);
    return await this.eventRepo.save(event);
  }

  async deleteEvent(id: string, projectId: string): Promise<void> {
    this.logger.log({ log: 'Attempting to soft delete event', id, projectId });

    const result = await this.eventRepo.softDelete({
      id: id as any,
      projectId: projectId as any,
    });

    if (result.affected === 0) {
      this.logger.log({ log: 'Delete failed: Event not found', id });
      throw new NotFoundException('Event not found or already deleted');
    }

    this.logger.log({ log: 'Event soft deleted successfully', id });
  }

  private scheduleReminder(eventId: number, executeAt: Date) {
    const delay = executeAt.getTime() - Date.now();

    // Nếu thời điểm nhắc nhở chưa trôi qua
    if (delay > 0) {
      const callback = () => {
        this.logger.log(`[REMINDER] Đang gửi thông báo cho sự kiện ID: ${eventId}`);
        this.sendNotification(eventId); // Gọi hàm gửi tin nhắn của bạn
      };

      const timeout = setTimeout(callback, delay);
      
      // Lưu vào registry để có thể quản lý (ví dụ: hủy nếu event bị xóa)
      const name = `event_reminder_${eventId}`;
      this.schedulerRegistry.addTimeout(name, timeout);
    }
  }

  private async sendNotification(eventId: number) {
    // Logic gửi tin nhắn cho người dùng (vào Mezon, Email, v.v.)
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event || event.status === EventStatus.CANCELLED) {
    this.logger.warn(`Event ${eventId} không hợp lệ hoặc đã bị hủy, không gửi notification.`);
    return;
    }

    // 2. Nội dung tin nhắn
  const message = `
 **NHẮC LỊCH SỰ KIỆN**
-----------------------
 **Tiêu đề:** ${event.title}
 **Bắt đầu:** ${new Date(event.startsAt).toLocaleString('vi-VN')}
 **Địa điểm:** ${event.location || 'Không xác định'}
 **Mô tả:** ${event.description || '...'}
  `.trim();

  // 3. Gửi tới Channel liên quan (Giả sử projectId tương ứng với Channel ID)
  try {
    this.logger.log(`[TRIGGER] Đang gửi thông báo cho sự kiện: ${event.title}`);
    
    // Ở đây bạn gọi hàm gửi tin nhắn thực tế, ví dụ:
    // await this.mezonService.sendMessage(event.projectId.toString(), message);
    
    console.log(`--- GỬI TIN NHẮN THÀNH CÔNG --- \n${message}`);
  } catch (error) {
    this.logger.error(`Lỗi khi gửi notification cho event ${eventId}:`, error);
    }
  } 
}