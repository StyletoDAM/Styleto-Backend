import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Suitcase, SuitcaseDocument } from './schemas/suitcase.schema';
import { CreateSuitcaseDto } from './dto/create-suitcase.dto';
import { UpdateSuitcaseDto } from './dto/update-suitcase.dto';
import { Clothes, ClothesDocument } from '../clothes/schemas/clothes.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { EventDocument } from 'src/events/schemas/events.schema';

@Injectable()
export class SuitcaseService {
  constructor(
    @InjectModel(Suitcase.name) private suitcaseModel: Model<SuitcaseDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Clothes.name) private clothesModel: Model<ClothesDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  //  Vérifie que toutes les clés étrangères existent
  private async validateForeignKeys(
    userId?: string,
    eventId?: string,
    clothesIds?: string[],
  ) {
    //  Vérif userId
    if (userId) {
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException(`Invalid userId: ${userId}`);
      }

      const userExists = await this.userModel.exists({ _id: userId });
      if (!userExists) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
    }

    //  Vérif eventId
    if (eventId) {
      if (!Types.ObjectId.isValid(eventId)) {
        throw new BadRequestException(`Invalid eventId: ${eventId}`);
      }

      const eventExists = await this.eventModel.exists({ _id: eventId });
      if (!eventExists) {
        throw new NotFoundException(`Event with ID ${eventId} not found`);
      }
    }

    //  Vérif clothesIds (liste d’IDs)
    if (clothesIds && clothesIds.length > 0) {
      for (const id of clothesIds) {
        if (!Types.ObjectId.isValid(id)) {
          throw new BadRequestException(`Invalid clothesId: ${id}`);
        }

        const clothesExists = await this.clothesModel.exists({ _id: id });
        if (!clothesExists) {
          throw new NotFoundException(`Clothes with ID ${id} not found`);
        }
      }
    }
  }

  // CREATE
  async create(createSuitcaseDto: CreateSuitcaseDto): Promise<Suitcase> {
    await this.validateForeignKeys(
      createSuitcaseDto.userId,
      createSuitcaseDto.event,
      createSuitcaseDto.clothes,
    );

    const suitcase = new this.suitcaseModel(createSuitcaseDto);
    return suitcase.save();
  }

  // READ ALL
  async findAll(): Promise<Suitcase[]> {
    return this.suitcaseModel.find().populate('userId event clothes').exec();
  }

  // READ ONE
  async findOne(id: string): Promise<Suitcase> {
    const suitcase = await this.suitcaseModel
      .findById(id)
      .populate('userId event clothes')
      .exec();

    if (!suitcase) {
      throw new NotFoundException(`Suitcase with ID ${id} not found`);
    }
    return suitcase;
  }

  // UPDATE
  async update(id: string, updateSuitcaseDto: UpdateSuitcaseDto): Promise<Suitcase> {
    await this.validateForeignKeys(
      updateSuitcaseDto.userId,
      updateSuitcaseDto.event,
      updateSuitcaseDto.clothes,
    );

    const updated = await this.suitcaseModel
      .findByIdAndUpdate(id, updateSuitcaseDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Suitcase with ID ${id} not found`);
    }
    return updated;
  }

  // DELETE
  async remove(id: string): Promise<{ message: string }> {
    const deleted = await this.suitcaseModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Suitcase with ID ${id} not found`);
    }
    return { message: 'Suitcase deleted successfully' };
  }
}
