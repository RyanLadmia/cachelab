import autocannon, { Result } from "autocannon";
import Aggregator from "./agregator.service";
import { LoadTestParams, LoadTestReport } from "../types/LoadTestType";

export class LoadTestBusyError extends Error {
    constructor() {
        super("Un test de charge est déjà en cours");
        this.name = "LoadTestBusyError";
    }
}

export default class LoadTestService {
    private running = false;

    constructor(private readonly aggregator: Aggregator<string, any>) {}

    isRunning(): boolean {
        return this.running;
    }

    async run(params: LoadTestParams): Promise<LoadTestReport> {
        if (this.running) {
            throw new LoadTestBusyError();
        }

        this.running = true;
        const baseUrl = params.baseUrl ?? "http://127.0.0.1:3001";
        const collectionName = params.collection ?? "cache";
        const stamp = Date.now();
        let sampleKey: string | null = null;
        let seeded = 0;

        const memoryBefore = this.readMemoryMb();
        const cpuStart = process.cpuUsage();
        const wallStart = process.hrtime.bigint();

        try {
            let collection;
            try {
                collection = this.aggregator.getCollection(collectionName);
            } catch {
                collection = await this.aggregator.loadCollectionFromFile(collectionName);
            }

            for (let i = 0; i < params.entries; i++) {
                const key = `stress-${stamp}-${i}`;
                await this.aggregator.insert(collectionName, { key, value: String(i) });
                if (i === 0) sampleKey = key;
                seeded++;
            }

            if (seeded > 0) {
                await this.aggregator.saveCollection(collectionName);
            }

            if (!sampleKey) {
                const keys = collection.getAllKeys();
                sampleKey = keys.length > 0 ? String(keys[0]) : null;
            }

            const listResult = await this.fireAutocannon({
                url: `${baseUrl}/api/${encodeURIComponent(collectionName)}/keys`,
                connections: params.connections,
                duration: params.duration,
            });

            let getOneResult: Result | null = null;
            if (sampleKey) {
                getOneResult = await this.fireAutocannon({
                    url: `${baseUrl}/api/${encodeURIComponent(collectionName)}/keys/${encodeURIComponent(sampleKey)}`,
                    connections: params.connections,
                    duration: params.duration,
                });
            }

            const merged = this.mergeResults(listResult, getOneResult);
            const snapshot = collection.getBucketsSnapshot();

            const cpuDelta = process.cpuUsage(cpuStart);
            const wallMs = Number(process.hrtime.bigint() - wallStart) / 1e6;
            const cpuUserMs = cpuDelta.user / 1000;
            const cpuSystemMs = cpuDelta.system / 1000;
            const cpuPercent =
                wallMs > 0
                    ? Math.round(((cpuUserMs + cpuSystemMs) / wallMs) * 1000) / 10
                    : 0;
            const memoryAfter = this.readMemoryMb();

            return {
                success: true,
                seeded,
                sampleKey,
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
            this.running = false;
        }
    }

    private readMemoryMb() {
        const mem = process.memoryUsage();
        const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
        return {
            rssMb: toMb(mem.rss),
            heapUsedMb: toMb(mem.heapUsed),
            heapTotalMb: toMb(mem.heapTotal),
        };
    }

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
                    pipelining: 1,
                },
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );

            instance.on("error", () => {});
        });
    }

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
        const totalDurationSec = (a.duration || 1) + (b.duration || 1);

        return {
            requests: {
                total: totalRequests,
                average: totalRequests / totalDurationSec,
            },
            throughput: {
                average: (a.throughput.average + b.throughput.average) / 2,
            },
            latency: {
                average: (a.latency.average + b.latency.average) / 2,
                p50: Math.max(a.latency.p50, b.latency.p50),
                p99: Math.max(a.latency.p99, b.latency.p99),
            },
            errors: a.errors + b.errors,
            timeouts: a.timeouts + b.timeouts,
        };
    }
}