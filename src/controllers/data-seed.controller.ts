import { FastifyReply, FastifyRequest } from "fastify";
import DataSeeder from "../services/data-seed-storage.service";
import InsertionWorker from "../worker/insertion.worker";

type SeedQuery = { numberOfInsertion: string };

export function DataSeedController(
    dataSeeder: DataSeeder,
    insertionWorker: InsertionWorker
) {
    return {
        seedFile: async function (
            request: FastifyRequest<{ Querystring: SeedQuery }>,
            _reply: FastifyReply
        ) {
            const numberOfInsertion = parseInt(request.query.numberOfInsertion, 10);

            dataSeeder.selectDataFile("init.json");
            const result = await dataSeeder.seedFile(numberOfInsertion);

            if (result) return { success: true };
            return { success: false };
        },

        processSeed: async function (
            _request: FastifyRequest,
            reply: FastifyReply
        ) {
            try {
                const result = await insertionWorker.processSeeding();

                if (result.success) {
                    return {
                        success: true,
                        message: `${result.count} entrées insérées avec succès.`,
                    };
                }

                return { success: false, message: "Rien n'a été inséré." };
            } catch (error) {
                console.error("Erreur fatale lors du seeding :", error);
                return reply.code(500).send({ success: false, error: "Erreur serveur" });
            }
        },
    };
}
