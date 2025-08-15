// force-https.ts
export const forceHttps = () => (req: any, res: any, next: any) => {
  const xfProto = req.headers['x-forwarded-proto'];
  if (process.env.NODE_ENV === 'production' && xfProto && xfProto !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
};

// HSTS header middleware (optional but recommended)
export const hstsHeader = () => (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
};
