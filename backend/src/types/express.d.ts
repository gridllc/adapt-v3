// Global type declarations for Express extensions

declare namespace Express {
  export interface Request {
    file?: Express.Multer.File
    files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[]
  }
}