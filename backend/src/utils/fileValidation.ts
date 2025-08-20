import type { MulterFile } from '../types/express.d.ts'
import path from 'path'
import { getUploadConfig } from '../config/env.js'

// 🎯 File validation interface
interface ValidationResult {
  isValid: boolean
  error?: string
  code?: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'DANGEROUS_EXTENSION' | 'NO_FILE' | 'EMPTY_FILENAME' | 'SPOOFED_MIMETYPE'
}

// 🎯 File validation options
interface ValidationOptions {
  maxSize?: number // in bytes
  allowedTypes?: string[]
  maxDuration?: number // for videos, in seconds
}

/**
 * 🎯 Validate uploaded file
 * 
 * @param file - Multer file object
 * @param options - Validation options
 * @returns ValidationResult
 */
export const validateFile = (
  file: MulterFile,
  options: ValidationOptions = {}
): ValidationResult => {
  const uploadConfig = getUploadConfig()
  const {
    maxSize = uploadConfig.maxFileSize, // Use environment config
    allowedTypes = uploadConfig.allowedVideoTypes // Use environment config
  } = options

  // 🎯 Check if file exists
  if (!file) {
    return {
      isValid: false,
      error: 'No file provided',
      code: 'NO_FILE'
    }
  }

  // 🎯 Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`,
      code: 'FILE_TOO_LARGE'
    }
  }

  // 🎯 Check file type
  const normalizedTypes = allowedTypes.map((type: string) => type.trim())
  const isAllowedType = normalizedTypes.some((type: string) => {
    if (type.endsWith('/*')) {
      const baseType = type.replace('/*', '')
      return file.mimetype.startsWith(baseType)
    }
    return file.mimetype === type
  })

  if (!isAllowedType) {
    return {
      isValid: false,
      error: `File type "${file.mimetype}" is not allowed. Allowed types: ${normalizedTypes.join(', ')}`,
      code: 'INVALID_TYPE'
    }
  }

  // 🎯 Check file name
  if (!file.originalname || file.originalname.trim() === '') {
    return {
      isValid: false,
      error: 'File name is required',
      code: 'EMPTY_FILENAME'
    }
  }

  // 🎯 Check for malicious file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js']
  const fileExtension = path.extname(file.originalname).toLowerCase()
  
  if (dangerousExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: 'Dangerous file type detected',
      code: 'DANGEROUS_EXTENSION'
    }
  }

  return { isValid: true }
}

/**
 * 🎯 Validate multiple files
 * 
 * @param files - Array of Multer file objects
 * @param options - Validation options
 * @returns ValidationResult
 */
export const validateFiles = (
  files: MulterFile[],
  options: ValidationOptions = {}
): ValidationResult => {
  if (!files || files.length === 0) {
    return {
      isValid: false,
      error: 'No files provided'
    }
  }

  for (const file of files) {
    const validation = validateFile(file, options)
    if (!validation.isValid) {
      return validation
    }
  }

  return { isValid: true }
}

/**
 * 🎯 Get file info for logging/debugging
 * 
 * @param file - Multer file object
 * @returns File info object
 */
export const getFileInfo = (file: MulterFile) => {
  return {
    name: file.originalname,
    size: file.size,
    type: file.mimetype,
    encoding: file.encoding,
    fieldname: file.fieldname
  }
}

/**
 * 🎯 Helper function for file size formatting
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * 🎯 Sanitize filename for safe storage
 * 
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 255) // Limit length
}

export default validateFile 