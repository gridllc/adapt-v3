declare module 'multer' {
  import { Request } from 'express'
  
  interface MulterFile {
    fieldname: string
    originalname: string
    encoding: string
    mimetype: string
    size: number
    destination?: string
    filename?: string
    path?: string
    buffer?: Buffer
  }

  interface MulterRequest extends Request {
    file?: MulterFile
    files?: { [fieldname: string]: MulterFile[] } | MulterFile[]
  }

  interface StorageEngine {
    _handleFile(req: any, file: any, callback: (error?: any, info?: any) => void): void
    _removeFile(req: any, file: any, callback: (error?: any) => void): void
  }

  interface DiskStorageOptions {
    destination?: string | ((req: any, file: any, callback: (error: any, destination: string) => void) => void)
    filename?: (req: any, file: any, callback: (error: any, filename: string) => void) => void
  }

  interface MemoryStorageOptions {
    // Memory storage doesn't need additional options
  }

  interface MulterOptions {
    dest?: string
    storage?: StorageEngine
    limits?: {
      fieldNameSize?: number
      fieldSize?: number
      fields?: number
      fileSize?: number
      files?: number
      parts?: number
      headerPairs?: number
    }
    preservePath?: boolean
    fileFilter?(req: any, file: any, callback: (error: any, acceptFile: boolean) => void): void
  }

  interface Multer {
    single(fieldname: string): any
    array(fieldname: string, maxCount?: number): any
    fields(fields: Array<{ name: string; maxCount?: number }>): any
    none(): any
    any(): any
  }

  interface MulterConstructor {
    (options?: MulterOptions): Multer
    diskStorage(options: DiskStorageOptions): StorageEngine
    memoryStorage(): StorageEngine
  }

  const multer: MulterConstructor
  export = multer
  export { MulterRequest, MulterFile, StorageEngine, DiskStorageOptions, MemoryStorageOptions, MulterOptions, Multer, MulterConstructor }
} 