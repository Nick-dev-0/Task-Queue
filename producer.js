require("dotenv").config();
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

const sampleJobs = [
  { type: "processPayment", payload: { orderId: "ORD-1001", amount: 49.99, customerId: "CUST-001" } },
  { type: "sendOrderConfirmation", payload: { orderId: "ORD-1001", email: "buyer@example.com" } },
  { type: "updateInventory", payload: { sku: "SKU-8842", quantityChange: -1 } },
  { type: "sendShippingNotification", payload: { orderId: "ORD-1001", trackingNumber: "1Z999AA10123456784" } },
];

async function addJobs() {
  try {
    const job = sampleJobs[Math.floor(Math.random() * sampleJobs.length)];
    const pushJob = await redis.lpush("jobs", JSON.stringify(job));

    if (pushJob) {
      console.log("Successfully added job", job);
    } else {
      const unknownType = await redis.lpush(
        "unknown-type",
        JSON.stringify(job),
      );
      console.log("Unknown Type", job);
    }
  } catch (error) {
    console.log("Something went wrong", error);
  }
}
addJobs();
