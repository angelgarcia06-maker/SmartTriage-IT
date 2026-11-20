import 'dotenv/config';
import { app } from './app';

const port = Number(process.env.PORT || 3000);
const host = process.env.SMARTTRIAGE_DEMO === '1' ? '127.0.0.1' : '0.0.0.0';

app.listen(port, host, () => console.log(`SmartTriage API: http://localhost:${port}/api/health`));
