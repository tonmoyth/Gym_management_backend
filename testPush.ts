import { pushJob } from "./src/utils/redisQueue";

async function testPush() {
    console.log("Pushing test job...");
    await pushJob("notification_queue", {
        eventType: "BUSINESS_ANNOUNCEMENT_CREATED",
        title: "Test",
        body: "Test body",
        businessId: "123",
        businessName: "Test Business",
        announcementId: "test_uuid",
        targetAudience: "BOTH"
    });
    console.log("Done");
    process.exit(0);
}

testPush();
