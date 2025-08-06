// Global type declarations for Express extensions
import { File } from 'multer'

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string
        originalname: string
        encoding: string
        mimetype: string
        size: number
        buffer: Buffer
        destination?: string
        filename?: string
        path?: string
        stream?: any
      }
    }
    
    interface Request {
      file?: Multer.File
      files?: { [fieldname: string]: Multer.File[] } | Multer.File[]
    }
  }
}