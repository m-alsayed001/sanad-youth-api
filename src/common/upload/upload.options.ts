import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';

export const UPLOAD_ROOT = 'uploads';

const rules = {
  images: {
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    exts: ['.jpg', '.jpeg', '.png', '.webp'],
    maxMb: 2,
  },
  cvs: { mimes: ['application/pdf'], exts: ['.pdf'], maxMb: 5 },
  materials: {
    mimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-zip-compressed',
      'image/jpeg',
      'image/png',
    ],
    exts: ['.pdf', '.pptx', '.docx', '.zip', '.jpg', '.jpeg', '.png'],
    maxMb: 20,
  },
};

export type UploadKind = keyof typeof rules;

// Files are saved on disk as uploads/<kind>/<uuid>.<ext>; the DB stores only that relative path.
// A random name means a user can't overwrite or guess someone else's file.
export function uploadOptions(kind: UploadKind): MulterOptions {
  const rule = rules[kind];
  const dir = `${UPLOAD_ROOT}/${kind}`;
  mkdirSync(dir, { recursive: true });
  return {
    storage: diskStorage({
      destination: dir,
      filename: (_req, file, cb) =>
        cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: rule.maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      if (!rule.mimes.includes(file.mimetype) || !rule.exts.includes(ext)) {
        return cb(
          new BadRequestException(
            `Invalid file type. Allowed: ${rule.exts.join(', ')} (max ${rule.maxMb}MB)`,
          ),
          false,
        );
      }
      cb(null, true);
    },
  };
}
