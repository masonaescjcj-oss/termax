import { editBroker } from './src/controllers/adminController';
import dotenv from 'dotenv';
dotenv.config();

const req: any = {
  params: {
    id: '38d5c58e-789b-43f6-b312-78eea74216a6' // RoboForex ID
  },
  body: {}
};

const res: any = {
  statusCode: 200,
  status: function(code: number) {
    this.statusCode = code;
    return this;
  },
  json: function(data: any) {
    console.log("Response Status Code:", this.statusCode);
    console.log("Response JSON:", data);
  }
};

async function run() {
  try {
    await editBroker(req, res);
  } catch (e) {
    console.error("Function threw error:", e);
  }
}
run();
