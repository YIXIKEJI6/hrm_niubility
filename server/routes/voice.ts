import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

const APPID = 'bee2ef27';
const API_SECRET = 'MzFmM2IyOWUxMjYyNTliODBhYWZlODY2';
const API_KEY = '1dbd3f4dda52d10634c57fa4e2cd2998';

router.get('/rtasr-url', (req, res) => {
  try {
    const ts = Math.floor(Date.now() / 1000).toString();
    
    // baseString = appId + ts
    const baseString = APPID + ts;
    
    // MD5 of baseString
    const md5Str = crypto.createHash('md5').update(baseString).digest('hex');
    
    // HMAC-SHA1 of md5Str using API_SECRET
    const signa = crypto.createHmac('sha1', API_SECRET).update(md5Str).digest('base64');
    
    const url = `wss://rtasr.xfyun.cn/v1/ws?appid=${APPID}&ts=${ts}&signa=${encodeURIComponent(signa)}`;
    
    res.json({ code: 0, data: { url } });
  } catch (error: any) {
    console.error('Error generating RTASR URL:', error);
    res.status(500).json({ code: 500, message: 'Internal Server Error' });
  }
});

export default router;
