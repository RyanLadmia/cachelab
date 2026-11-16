import autocannon, { Result } from "autocannon";
import HashMap from "./hashmap.service";

// Input parameters for a server-side stress run
export type LoadTestParams = {
    entries: number;
    connections: number;
    duration: number;
    baseUrl?: string;
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

// Raised when a second load test is requested while one is already running
export class LoadTestBusyError extends Error {
    constructor() {
        super("Un test de charge est déjà en cours");
        this.name = "LoadTestBusyError";
    }
}

// Orchestrates volume seeding on the live hashmap, then HTTP load via autocannon
export default class LoadTestService {
    // Ensures only one load test runs at a time in this process
    private running = false;

    constructor(private readonly hashmap: HashMap<string, string>) {}

    isRunning(): boolean {
        return this.running;
    }

    async run(params: LoadTestParams): Promise<LoadTestReport> {
        if (this.running) {
            throw new LoadTestBusyError();
        }

        this.running = true;
        // Default target is the local Fastify server (same process)
        const baseUrl = params.baseUrl ?? "http://127.0.0.1:3001";
        // Timestamp prefix keeps seeded keys unique across runs
        const stamp = Date.now();
        let sampleKey: string | null = null;
        let seeded = 0;

        // Baseline system metrics before seed + barrage
        const memoryBefore = this.readMemoryMb();
        const cpuStart = process.cpuUsage();
        const wallStart = process.hrtime.bigint();

        try {
            // Phase 1: insert N unique keys into the live in-memory hashmap
            for (let i = 0; i < params.entries; i++) {
                const key = `stress-${stamp}-${i}`;
                await this.hashmap.insert({ key, value: String(i) });
                // Keep the first key for the GET /keys/:key autocannon pass
                if (i === 0) sampleKey = key;
                seeded++;
            }

            // Force disk flush for leftovers below the batch save limit
            if (seeded > 0) {
                await this.hashmap.saveToDisk();
            }

            // If no new keys were seeded, fall back to an existing key if any
            if (!sampleKey) {
                const keys = this.hashmap.getAllKeys();
                sampleKey = keys.length > 0 ? String(keys[0]) : null;
            }

            // Phase 2a: concurrent GET /keys (list all keys)
            const listResult = await this.fireAutocannon({
                url: `${baseUrl}/keys`,
                connections: params.connections,
                duration: params.duration,
            });

            // Phase 2b: concurrent GET /keys/:key when a sample key exists
            let getOneResult: Result | null = null;
            if (sampleKey) {
                getOneResult = await this.fireAutocannon({
                    url: `${baseUrl}/keys/${encodeURIComponent(sampleKey)}`,
                    connections: params.connections,
                    duration: params.duration,
                });
            }

            const merged = this.mergeResults(listResult, getOneResult);
            const snapshot = this.hashmap.getBucketsSnapshot();

            // CPU delta since start; wall clock in milliseconds
            const cpuDelta = process.cpuUsage(cpuStart);
            const wallMs = Number(process.hrtime.bigint() - wallStart) / 1e6;
            // cpuUsage values are microseconds → convert to ms
            const cpuUserMs = cpuDelta.user / 1000;
            const cpuSystemMs = cpuDelta.system / 1000;
            // Approximate CPU % of this Node process over the wall duration
            const cpuPercent =
                wallMs > 0
                    ? Math.round(((cpuUserMs + cpuSystemMs) / wallMs) * 1000) / 10
                    : 0;
            const memoryAfter = this.readMemoryMb();

            return {
                success: true,
                seeded,
                sampleKey,
                // Each autocannon pass lasts `duration` seconds
                durationSec: params.duration * (getOneResult ? 2 : 1),
                connections: params.connections,
                requests: {
                    total: merged.requests.total,
                    average: merged.requests.average,
                },
                throughput: {
                    average: merged.throughput.average,
                },
                latency: {
                    average: merged.latency.average,
                    p50: merged.latency.p50,
                    p99: merged.latency.p99,
                },
                errors: merged.errors,
                timeouts: merged.timeouts,
                system: {
                    cpuPercent,
                    cpuUserMs: Math.round(cpuUserMs * 10) / 10,
                    cpuSystemMs: Math.round(cpuSystemMs * 10) / 10,
                    wallMs: Math.round(wallMs),
                    memory: {
                        before: memoryBefore,
                        after: memoryAfter,
                        delta: {
                            rssMb: Math.round((memoryAfter.rssMb - memoryBefore.rssMb) * 10) / 10,
                            heapUsedMb:
                                Math.round((memoryAfter.heapUsedMb - memoryBefore.heapUsedMb) * 10) /
                                10,
                        },
                    },
                },
                hashmap: {
                    length: snapshot.length,
                    load: snapshot.load,
                    collisions: snapshot.collisions,
                    occupied: snapshot.occupied,
                },
            };
        } finally {
            // Always release the lock, even if seeding or autocannon fails
            this.running = false;
        }
    }

    // Snapshot process memory in megabytes (RSS + V8 heap)
    private readMemoryMb() {
        const mem = process.memoryUsage();
        const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
        return {
            rssMb: toMb(mem.rss),
            heapUsedMb: toMb(mem.heapUsed),
            heapTotalMb: toMb(mem.heapTotal),
        };
    }

    // Run one autocannon barrage against a single URL
    private fireAutocannon(options: {
        url: string;
        connections: number;
        duration: number;
    }): Promise<Result> {
        return new Promise((resolve, reject) => {
            const instance = autocannon(
                {
                    url: options.url,
                    connections: options.connections,
                    duration: options.duration,
                    // One in-flight request per connection
                    pipelining: 1,
                },
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );

            // Swallow autocannon stream errors so they do not spam stdout
            instance.on("error", () => {});
        });
    }

    // Combine two autocannon results (list + getOne), or pass through a single one
    private mergeResults(a: Result, b: Result | null) {
        if (!b) {
            return {
                requests: {
                    total: a.requests.total,
                    average: a.requests.average,
                },
                throughput: {
                    average: a.throughput.average,
                },
                latency: {
                    average: a.latency.average,
                    p50: a.latency.p50,
                    p99: a.latency.p99,
                },
                errors: a.errors,
                timeouts: a.timeouts,
            };
        }

        const totalRequests = a.requests.total + b.requests.total;
        // autocannon reports duration in seconds
        const totalDurationSec = (a.duration || 1) + (b.duration || 1);

        return {
            requests: {
                total: totalRequests,
                // Overall RPS across both passes
                average: totalRequests / totalDurationSec,
            },
            throughput: {
                average: (a.throughput.average + b.throughput.average) / 2,
            },
            latency: {
                average: (a.latency.average + b.latency.average) / 2,
                // Keep the worse percentile as a conservative signal
                p50: Math.max(a.latency.p50, b.latency.p50),
                p99: Math.max(a.latency.p99, b.latency.p99),
            },
            errors: a.errors + b.errors,
            timeouts: a.timeouts + b.timeouts,
        };
    }
}
