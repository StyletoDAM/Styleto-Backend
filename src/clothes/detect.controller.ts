// src/detect/detect.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';

const execAsync = promisify(exec);

@Controller('detect')
export class DetectController {
  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './temp_uploads',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async detect(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Photo requise');
    }

    const tempPath = file.path;

    try {
      // Upload Cloudinary
      const uploadResult = await cloudinary.uploader.upload(tempPath, {
        folder: 'labasni',
      });

      // Détection Python
      const { stdout } = await execAsync(`python3 detect.py --image "${tempPath}"`);

      // Nettoyage
      fs.unlinkSync(tempPath);

      return {
        success: true,
        image_url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        detection_result: stdout.trim(),
      };
    } catch (err: any) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      throw new BadRequestException(err.message || 'Erreur lors de la détection');
    }
  }
}