
import { UserTier } from "./enums";
import { User } from "./models";
import { RateLimiterService } from "./service/RateLimiterService";

async function checkConcurrency(
    rateLimiterService: RateLimiterService
): Promise<void> {
    const freeUser1 = new User("user1", UserTier.FREE);

    const threads = 20; // simulate 20 concurrent requests

    const tasks = Array.from({ length: threads }, (_, index) => {
        const reqNum = index + 1;

        return Promise.resolve().then(() => {
            const allowed =
                rateLimiterService.allowRequest(freeUser1);

            console.log(
                `${reqNum} | Request for FreeUser1: ${allowed ? "ALLOWED" : "BLOCKED"
                }`
            );
        });
    });

    await Promise.all(tasks);
}

async function main() {
    const rateLimiterService = new RateLimiterService();

    const freeUser = new User("user1", UserTier.FREE); // 10 req in 60 sec
    const premiumUser = new User("user2", UserTier.PREMIUM); // 100 req in 60 sec

    // ===== Free User Requests =====
    for (let i = 1; i <= 15; i++) {
        const allowed =
            rateLimiterService.allowRequest(freeUser);

        console.log(
            `Request ${i} for Free User: ${allowed ? "ALLOWED" : "BLOCKED"
            }`
        );

        await sleep(100);
    }

    // ===== Premium User Requests =====
    for (let i = 1; i <= 120; i++) {
        const allowed =
            rateLimiterService.allowRequest(premiumUser);

        console.log(
            `Request ${i} for Premium User: ${allowed ? "ALLOWED" : "BLOCKED"
            }`
        );

        await sleep(100);
    }

    // await checkConcurrency(rateLimiterService);
}

// helper sleep function
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);