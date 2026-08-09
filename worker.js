require("dotenv").config();
const { parse } = require("dotenv");
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);
function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let receivedJob;

const jobsMap = {
  'processPayment': processPayment,
  'sendOrderConfirmation': sendOrderConfirmation,
  'updateInventory': updateInventory,
  'sendShippingNotification': sendShippingNotification,
}


function processPayment(payload) {
  console.log(`Charging $${payload.amount} to ${payload.customerId} for order ${payload.orderId}`);
}
function sendOrderConfirmation(payload) {
  console.log(`Sending order confirmation for ${payload.orderId} to ${payload.email}`);
}
function updateInventory(payload) {
  console.log(`Updating inventory for ${payload.sku}: quantity change ${payload.quantityChange}`);
}
function sendShippingNotification(payload) {
  console.log(`Sending shipping notification for ${payload.orderId}, tracking ${payload.trackingNumber}`);
}

class Worker {
  async recieveJobs() {
    while (true) {
      try {
        receivedJob = await redis.rpop("jobs");
        if (receivedJob) {
          const parsedJob = JSON.parse(receivedJob);
          const jobType = parsedJob.type;

          console.log(parsedJob);
          if (jobsMap[jobType] !== undefined) {
            jobsMap[jobType](parsedJob.payload);
          } else {
            console.log("unknown job type")
            await redis.lpush("unknown-type", JSON.stringify(parsedJob));
          }
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
        await redis.ltrim("errors", 0, 1000);
        await pause(2000);
      }
    }
  }
}

const worker = new Worker();
worker.recieveJobs();
