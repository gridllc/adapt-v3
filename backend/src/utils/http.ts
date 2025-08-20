export const ok = (res: any, data: any = {}) => res.json({ success: true, ...data });
export const fail = (res: any, code: number, error: string, details?: any) =>
  res.status(code).json({ success: false, error, ...(details ? { details } : {}) });
