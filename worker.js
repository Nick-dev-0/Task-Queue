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

function processPayment(jobType, payload) {
  if (payload.amount === undefined || isNaN(payload.amount)) {
    throw new HandlerError(
      "Payload amount is undefined or not numeric",
      jobType,
    );
  } else {
    console.log(
      `Charging $${payload.amount} to ${payload.customerId} for order ${payload.orderId}`,
    );
  }
}
function sendOrderConfirmation(jobType, payload) {
  console.log(
    `Sending order confirmation for ${payload.orderId} to ${payload.email}`,
  );
}
function updateInventory(jobType, payload) {
  if (payload.quantityChange >= 0)
    throw new HandlerError("Payload quantity charge is non negative", jobType)
  console.log(
    `Updating inventory for ${payload.sku}: quantity change ${payload.quantityChange}`,
  );
}
function sendShippingNotification(jobType, payload) {
  console.log(
    `Sending shipping notification for ${payload.orderId}, tracking ${payload.trackingNumber}`,
  );
}

class HandlerError extends Error {
  constructor(message, jobType) {
    super(message);
    this.message = message;
    this.jobType = jobType;
  }
}

class Worker {
  async recieveJobs() {
    let receivedJob;
    let parsedJob;
    while (true) {
      try {
        receivedJob = await redis.rpop("jobs");
        if (receivedJob) {
          parsedJob = JSON.parse(receivedJob);
          const jobType = parsedJob.type;

          console.log(parsedJob);

          if (jobsMap[jobType] !== undefined) {
            jobsMap[jobType](jobType, parsedJob.payload);
          } else {
            console.log("our job type is", jobType)
            console.log("our payload is", parsedJob.payload)
            console.log("unknown job type");
            await redis.lpush("unknown-type", JSON.stringify(parsedJob));
          }
        } else {
          console.log("pausing for two seconds");
          await pause(2000); // TODO add Exponential Backoff
        }
      } catch (error) {
        if (error instanceof HandlerError) {
          let jobAttempts = parsedJob.attempts ?? 0
          jobAttempts += 1
          const fullJob = {...parsedJob, 'attempts': jobAttempts}
          if (jobAttempts <= 3) {
            const resendJob = await redis.lpush("jobs", JSON.stringify(fullJob))
            console.log("Current attempts", jobAttempts)
          }
          console.log("Failed to retry")
          console.log(
            "Handler failed:",
            "job type:",
            error.jobType,
            "|",
            "error message:",
            error.message,
          );
          try {
            const handlerError = await redis.lpush(
             error.jobType + " errors",
              error.message,
            );
            console.log("Sent handlerError error");
          } catch (redisError) {
            console.log("Something went wrong sending handlerError error", error.jobType, error.message, "\nRedis Error: ", redisError);
          }
        } else {
          console.log("Infra/unexpected error:", error);

          const errorReport = {
            job: receivedJob,
            error: error.message,
            failedAt: Date.now(),
          };
          await redis.lpush("errors", JSON.stringify(errorReport));
          await redis.ltrim("errors", 0, 1000);
        }
        await pause(2000);
      }
    }
  }
}

const worker = new Worker();
worker.recieveJobs();
