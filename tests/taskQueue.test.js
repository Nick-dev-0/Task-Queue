const { processPayment, sendOrderConfirmation, updateInventory, sendShippingNotification, HandlerError } = require("../worker.js");

describe("test handlers to ensure they are working", () => {
    test("ensure processPayment works", () => {
        const processPaymentJob = { type: "processPayment", payload: { orderId: "ORD-1001", amount: 49.99, customerId: "CUST-001" }}
        
        const jobType = processPaymentJob.type
        const payload = processPaymentJob.payload
        
        expect(() => processPayment(jobType, payload)).not.toThrow()
    })

    test("ensure updateInventory works", () => {
        const updateInventoryJob = { type: "updateInventory", payload: { sku: "SKU-8842", quantityChange: -1 } }
        
        const jobType = updateInventoryJob.type
        const payload = updateInventoryJob.payload
        
        expect(() => updateInventory(jobType, payload)).not.toThrow()
    })
})





describe("test handlers errors", () => {
    test("make sure processPayment is throwing errors correctly", () => {
        const processPaymentJob = { type: "processPayment", payload: { orderId: "ORD-1001", amount: undefined, customerId: "CUST-001" }}
        const jobType = processPaymentJob.type
        const payload = processPaymentJob.payload
        
        expect(() => processPayment(jobType, payload)).toThrow(HandlerError)
    })

    test("ensure updateInventory works", () => {
        const updateInventoryJob = { type: "updateInventory", payload: { sku: "SKU-8842", quantityChange: 50 } }
        
        const jobType = updateInventoryJob.type
        const payload = updateInventoryJob.payload
        
        expect(() => updateInventory(jobType, payload)).toThrow(HandlerError)
    })
})