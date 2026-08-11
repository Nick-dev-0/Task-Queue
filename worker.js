require("dotenv").config();
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

const MAX_RETRIES = 3;
const BACKOFF_CAP_MS = 10000;
const BACKOFF_BASE_MS = 1000;


function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    let emptyPollCount = 0;
    let consecutiveInfraFailures = 0;

    while (true) {
      try {
        receivedJob = await redis.rpop("jobs");
        if (receivedJob) {
          parsedJob = JSON.parse(receivedJob);
          const jobType = parsedJob.type;

          console.log(parsedJob);
          emptyPollCount = 0
          consecutiveInfraFailures = 0

          if (jobsMap[jobType] !== undefined) {
            jobsMap[jobType](jobType, parsedJob.payload);
          } else {
            console.log("our job type is", jobType)
            console.log("our payload is", parsedJob.payload)
            console.log("unknown job type");
            await redis.lpush("unknown-type", JSON.stringify(parsedJob));
          }
        } else {
          emptyPollCount += 1
          let pauseTimer = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * (2 ** emptyPollCount))
          await pause(pauseTimer); 
          console.log("Pausing for:", pauseTimer)
        }
      } catch (error) {
        if (error instanceof HandlerError) {
          let jobAttempts = parsedJob.attempts ?? 0
          jobAttempts += 1
          const fullJob = {...parsedJob, 'attempts': jobAttempts}
          if (jobAttempts <= MAX_RETRIES) {
            const resendJob = await redis.lpush("jobs", JSON.stringify(fullJob))
            console.log("Current attempts", jobAttempts)
          } else {
              const deadLetter = await redis.lpush("dead-letter", JSON.stringify({ 'job': fullJob, 'error': error.message}))
              console.log("Failed to retry")
          }
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
          let handlerPauseTimer = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * (2 ** (jobAttempts - 1)))
          await pause(handlerPauseTimer)
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
        consecutiveInfraFailures += 1
        const infraPauseTimer = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * (2 ** consecutiveInfraFailures))
        await pause(infraPauseTimer);
      }
    }
  }
}

const worker = new Worker();
worker.recieveJobs();
