import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from './schemas/events.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Clothes, ClothesDocument } from '../clothes/schemas/clothes.schema';
import { User, UserDocument } from 'src/user/schemas/user.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Clothes.name) private readonly clothesModel: Model<ClothesDocument>,
  ) {}

  // ✅ Vérifie si un ObjectId est valide
  private validateObjectId(id: string, fieldName: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ForbiddenException(`Invalid ${fieldName} ID format`);
    }
  }

  // ✅ Vérifie si un utilisateur existe
  private async verifyUserExists(userId: string) {
    this.validateObjectId(userId, 'user');
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);
  }

  // ✅ Vérifie si un vêtement existe (si applicable)
  private async verifyClotheExists(clotheId: string) {
    this.validateObjectId(clotheId, 'clothe');
    const clothe = await this.clothesModel.findById(clotheId).exec();
    if (!clothe) throw new NotFoundException(`Clothe with ID ${clotheId} not found`);
  }

  // ✅ CREATE
  async create(createEventDto: CreateEventDto): Promise<Event> {
    // Vérification des clés étrangères
    if (createEventDto.userId) {
      await this.verifyUserExists(createEventDto.userId);
    }

    if ((createEventDto as any).clotheId) {
      await this.verifyClotheExists((createEventDto as any).clotheId);
    }

    const event = new this.eventModel(createEventDto);
    return await event.save();
  }

  // ✅ READ ALL
  async findAll(): Promise<Event[]> {
    return await this.eventModel
      .find()
      .populate('userId', '-password -__v')
      .populate('clotheId')
      .exec();
  }

  // ✅ READ ONE
  async findOne(id: string): Promise<Event> {
    this.validateObjectId(id, 'event');

    const event = await this.eventModel
      .findById(id)
      .populate('userId', '-password -__v')
      .populate('clotheId')
      .exec();

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  // ✅ UPDATE
  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    this.validateObjectId(id, 'event');

    if (updateEventDto.userId) {
      await this.verifyUserExists(updateEventDto.userId);
    }

    if ((updateEventDto as any).clotheId) {
      await this.verifyClotheExists((updateEventDto as any).clotheId);
    }

    const updated = await this.eventModel
      .findByIdAndUpdate(id, updateEventDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return updated;
  }

  // ✅ DELETE
  async remove(id: string): Promise<Event> {
    this.validateObjectId(id, 'event');

    const deleted = await this.eventModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return deleted;
  }
}
