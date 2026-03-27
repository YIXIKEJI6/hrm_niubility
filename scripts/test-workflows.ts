import { initDb, getDb } from '../server/config/database';
import WorkflowRoutes from '../server/routes/workflows';
import express from 'express';
import request from 'supertest';

const app = express();
app.use((req: any, res: any, next: any) => {
  req.userId = 'zhangwei';
  getDb(); // Ensure db is initialized
  next();
});
app.use('/workflows', WorkflowRoutes);

request(app)
  .get('/workflows/pending')
  .expect(200)
  .end((err, res) => {
    if (err) {
       console.error("ERROR:");
       console.error(res?.body || res?.text || err);
    } else {
       console.log('Success! Data Length:', res.body.data?.length);
       console.log('Body:', JSON.stringify(res.body));
    }
    process.exit(0);
  });
