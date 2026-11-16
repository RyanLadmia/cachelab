import DataSeeder from "../services/data-seed-storage.service";
import Aggregator from "../services/agregator.service";
import HashMap from "../services/hashmap.service";

export default class InsertionWorker {

    private dataSeeder: DataSeeder;
    private aggregator: Aggregator<string, any>;

    constructor(aggregator: Aggregator<string, any>, dataSeeder: DataSeeder) {
        this.aggregator = aggregator;
        this.dataSeeder = dataSeeder; 
    }
    // cache fait référence a cache.json
    async processSeeding(seedFileName: string = "init.json", targetMapName: string = "cache") {
        
        this.dataSeeder.selectDataFile(seedFileName);
        const seedData = await this.dataSeeder.getSeedFile();

        if (!seedData || seedData.length === 0) {
            console.log("Aucune donnée à insérer.");
            return { success: false, count: 0 };
        }

        try {
            this.aggregator.getCollection(targetMapName);
        } catch {
            await this.aggregator.loadCollectionFromFile(targetMapName);
        }

        await this.seedLoop(seedData, targetMapName);

        return { success: true, count: seedData.length };
    }

    private async seedLoop(seedData: any[], collectionName: string) {
        console.log(`Début de l'insertion de ${seedData.length} éléments...`);
        
        for (const item of seedData) {
            if (item && item.key !== undefined) {
                await this.aggregator.insert(collectionName, { key: String(item.key), value: item.value });
            }
        }
        
        await this.aggregator.saveCollection(collectionName);
        
        console.log("Insertion terminée avec succès !");
    }
}