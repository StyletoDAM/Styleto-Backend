import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Avatar, AvatarDocument } from './schemas/avatar.schema';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { User } from 'src/user/schemas/user.schema';

@Injectable()
export class AvatarService {
  constructor(
    @InjectModel(Avatar.name) private avatarModel: Model<AvatarDocument>,
    @InjectModel(User.name) private userModel: Model<Document>,
  ) {}

  //  Vérification que l'utilisateur existe avant de créer un avatar
  private async verifyUserExists(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException(`Invalid user ID format`);
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  // CREATE
  async create(createAvatarDto: CreateAvatarDto): Promise<Avatar> {
    await this.verifyUserExists(createAvatarDto.userId);

    const newAvatar = new this.avatarModel(createAvatarDto);
    return await newAvatar.save();
  }

  //  FIND ALL
  async findAll(): Promise<Avatar[]> {
    return await this.avatarModel.find().populate('userId', '-password').exec();
  }

  //  FIND ONE
  async findOne(id: string): Promise<Avatar> {
    const avatar = await this.avatarModel.findById(id).populate('userId', '-password').exec();
    if (!avatar) {
      throw new NotFoundException(`Avatar with ID ${id} not found`);
    }
    return avatar;
  }

  //  UPDATE
  async update(id: string, updateAvatarDto: UpdateAvatarDto): Promise<Avatar> {
    if (updateAvatarDto.userId) {
      await this.verifyUserExists(updateAvatarDto.userId);
    }

    const updated = await this.avatarModel
      .findByIdAndUpdate(id, updateAvatarDto, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Avatar with ID ${id} not found`);
    }

    return updated;
  }

  //  DELETE
  async remove(id: string): Promise<Avatar> {
    const deleted = await this.avatarModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Avatar with ID ${id} not found`);
    }
    return deleted;
  }
}
