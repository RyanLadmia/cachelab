import { FastifyReply, FastifyRequest } from "fastify";
import LoadTestService, { LoadTestBusyError } from "../services/load-test.service";

type LoadTestBody = {
    entries?: number;
    connections?: number;
    duration?: number;
    collection?: string;
};

export function LoadTestController(loadTestService: LoadTestService) {
    return {
        run: async function (
            request: FastifyRequest<{ Body: LoadTestBody }>,
            reply: FastifyReply
        ) {
            const body = request.body ?? {};
            const entries = Number(body.entries);
            const connections = Number(body.connections);
            const duration = Number(body.duration);
            const collection = body.collection ?? "cache";

            if (!Number.isFinite(entries) || entries < 0 || entries > 50000) {
                return reply.code(400).send({ error: "entries doit être entre 0 et 50000" });
            }
            if (!Number.isFinite(connections) || connections < 1 || connections > 500) {
                return reply.code(400).send({ error: "connections doit être entre 1 et 500" });
            }
            if (!Number.isFinite(duration) || duration < 1 || duration > 60) {
                return reply.code(400).send({ error: "duration doit être entre 1 et 60 secondes" });
            }

            try {
                const report = await loadTestService.run({
                    entries: Math.floor(entries),
                    connections: Math.floor(connections),
                    duration: Math.floor(duration),
                    collection: collection,
                });
                return report;
            } catch (error) {
                if (error instanceof LoadTestBusyError) {
                    return reply.code(409).send({ error: error.message });
                }
                console.error("Erreur load-test :", error);
                return reply.code(500).send({
                    error: error instanceof Error ? error.message : "Load test failed",
                });
            }
        },
    };
}