export type LoadTestParams = {
    entries: number;
    connections: number;
    duration: number;
    baseUrl?: string;
    collection?: string;
};

// Aggregated report returned to the API / UI after the test
export type LoadTestReport = {
    success: true;
    seeded: number;
    sampleKey: string | null;
    durationSec: number;
    connections: number;
    requests: {
        total: number;
        average: number;
    };
    throughput: {
        average: number;
    };
    latency: {
        average: number;
        p50: number;
        p99: number;
    };
    errors: number;
    timeouts: number;
    // Native process CPU / RAM samples around the whole run
    system: {
        cpuPercent: number;
        cpuUserMs: number;
        cpuSystemMs: number;
        wallMs: number;
        memory: {
            before: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
            after: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
            delta: { rssMb: number; heapUsedMb: number };
        };
    };
    // Live hashmap stats after seeding + HTTP barrage
    hashmap: {
        length: number;
        load: number;
        collisions: number;
        occupied: number;
    };
};