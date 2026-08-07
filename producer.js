require("dotenv").config();
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);
const sampleJob = { type: "sendEmail", payload: { to: "test@test.com" } };


async function addJobs() {
  try {
    const job = await redis.lpush("jobs", JSON.stringify(sampleJob));
    if (job) console.log("Successfully added job");
  } catch (error) {
    console.log("Something went wrong", error);
  }
}
addJobs();
