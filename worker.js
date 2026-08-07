require("dotenv").config();
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);
function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


let receivedJob;

class Worker {
  async recieveJobs() {
    while (true) {
      try {
        receivedJob = await redis.rpop("jobs");
        if (receivedJob) {
          const parsedJob = JSON.parse(receivedJob);
          console.log(parsedJob);
        } else {
          await pause(2000); // TODO add Exponential Backoff
        }
      } catch (error) {
        console.log("Something went wrong!", error);
        const errorReport = {
          job: receivedJob,
          error: error.message,
          failedAt: Date.now(),
        };
        await redis.lpush("errors", JSON.stringify(errorReport));
      }
    }
  }
}

const worker = new Worker();
worker.recieveJobs();
