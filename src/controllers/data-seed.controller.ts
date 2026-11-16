import { FastifyReply, FastifyRequest } from "fastify";
import DataSeeder from "../services/data-seed-storage.service";
import InsertionWorker from "../worker/insertion.worker";

type SeedQuery = { numberOfInsertion: string; collection?: string };
type RunSeedQuery = { collection?: string; seedFile?: string };

export function DataSeedController(
    dataSeeder: DataSeeder,
    insertionWorker: InsertionWorker
) {
    return {
        // Route pour lister les fichiers disponibles dans data/seed/
        listSeeds: async function (_request: FastifyRequest, _reply: FastifyReply) {
            return await dataSeeder.listSeedFiles();
        },

        seedFile: async function (
            request: FastifyRequest<{ Querystring: SeedQuery }>,
            _reply: FastifyReply
        ) {
            const numberOfInsertion = parseInt(request.query.numberOfInsertion, 10);
            const targetCollection = request.query.collection || "cache";
            
            // Nom du fichier de seed généré
            const seedFileName = `seed-${targetCollection}.json`;
            dataSeeder.selectDataFile(seedFileName);
            const result = await dataSeeder.seedFile(numberOfInsertion);

            return { success: result, filename: seedFileName };
        },

        processSeed: async function (
            request: FastifyRequest<{ Querystring: RunSeedQuery }>,
            reply: FastifyReply
        ) {
            try {
                const targetCollection = request.query.collection || "cache";
                // Récupère le fichier de seed choisi (ex: init.json ou seed-users.json)
                const seedFileQuery = request.query.seedFile || "init.json";
                
                // On pointe explicitement vers le dossier data/seed/
                const fullSeedPath = `${seedFileQuery}`; 

                const result = await insertionWorker.processSeeding(fullSeedPath, targetCollection);

                if (result.success) {
                    return {
                        success: true,
                        message: `${result.count} entrées de [${seedFileQuery}] injectées dans la collection [${targetCollection}] (data/${targetCollection}.json).`,
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