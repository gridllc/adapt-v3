import axios from 'axios'

// ===== API CONFIG =====
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ===== GLOBAL RESPONSE TYPE =====
export interface ApiResponse<T = any> {
  success: boolean
  error?: string
  data?: T
}

// ===== UPLOAD TYPES =====
export interface UploadInitResponse {
  moduleId: string
  presignedUrl: string
  key: string
}

export interface UploadCompleteResponse {
  moduleId: string
}

export interface UploadResult {
  success: boolean
  moduleId?: string
  error?: string
}

// ===== VIDEO TYPES =====
export interface VideoUrlResponse {
  url: string
}

// ===== HELPERS =====
// Example: GET wrapper
export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const res = await apiClient.get(path)
    return { success: true, data: res.data }
  } catch (err: any) {
    console.error(`❌ GET ${path} failed:`, err)
    return { success: false, error: err.message }
  }
}

// Example: POST wrapper
export async function apiPost<T>(
  path: string,
  body: any
): Promise<ApiResponse<T>> {
  try {
    const res = await apiClient.post(path, body)
    return { success: true, data: res.data }
  } catch (err: any) {
    console.error(`❌ POST ${path} failed:`, err)
    return { success: false, error: err.message }
  }
}