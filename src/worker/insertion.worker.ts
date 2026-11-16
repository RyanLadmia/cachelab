import DataSeeder from "../services/data-seed-storage.service";
import Aggregator from "../services/agregator.service";

export default class InsertionWorker {
    private dataSeeder: DataSeeder;
    private aggregator: Aggregator<string, any>;

    constructor(aggregator: Aggregator<string, any>, dataSeeder: DataSeeder) {
        this.aggregator = aggregator;
        this.dataSeeder = dataSeeder;
    }

    async processSeeding(
        seedFileName: string = "init.json", 
        targetMapName: string = "cache",
        chunkSize: number = 10000, // Taille des paquets pour la cadence
        delayMs: number = 0       // Délai optionnel entre les paquets pour respirer (throttling)
    ) {
        try {
            this.dataSeeder.selectDataFile(seedFileName);
            const seedData = await this.dataSeeder.getSeedFile();

            if (!seedData || !Array.isArray(seedData) || seedData.length === 0) {
                console.log(`[Worker] Le fichier ${seedFileName} est introuvable ou vide.`);
                return { success: false, count: 0 };
            }

            try {
                this.aggregator.getCollection(targetMapName);
            } catch {
                await this.aggregator.loadCollectionFromFile(targetMapName);
            }

            const totalItems = seedData.length;
            console.log(`[Worker] Début de l'insertion cadencée de ${totalItems} éléments dans [${targetMapName}] (Paquets de ${chunkSize})...`);

            let insertedCount = 0;

            // Insertion par chunks pour éviter de saturer la pile et permettre un suivi de cadence
            for (let i = 0; i < totalItems; i += chunkSize) {
                const chunk = seedData.slice(i, i + chunkSize);
                const itemsToInsert = chunk
                    .filter((item: any) => item && item.key !== undefined)
                    .map((item: any) => ({ key: String(item.key), value: item.value }));

                if (itemsToInsert.length > 0) {
                    // Utilise insertMany pour insérer le paquet directement en RAM
                    await this.aggregator.insertMany(targetMapName, itemsToInsert);
                    insertedCount += itemsToInsert.length;
                }

                // Optionnel : petite pause pour laisser respirer l'Event Loop sur de très gros volumes (ex: 1M)
                if (delayMs > 0 && i + chunkSize < totalItems) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }

                // Log de progression tous les 100 000 éléments ou à la fin
                if (insertedCount % 100000 === 0 || insertedCount === totalItems) {
                    console.log(`[Worker] Progression : ${insertedCount} / ${totalItems} entrées insérées...`);
                }
            }

            console.log(`[Worker] Insertion cadencée terminée avec succès (${insertedCount} entrées).`);
            return { success: true, count: insertedCount };

        } catch (error) {
            console.error("[Worker] Erreur durant processSeeding :", error);
            return { success: false, count: 0 };
        }
    }
}