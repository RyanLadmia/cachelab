import DataSeeder from "../services/data-seed-storage.service";
import HashMap from "../services/hashmap.service";
import path from "path";

export default class InsertionWorker {

    private dataSeeder: DataSeeder;

    constructor() {
        this.dataSeeder = new DataSeeder();
    }

async processSeeding(seedFileName: string = "init.json", targetMapName: string = "cache.json") {
        
        const targetFilePath = path.join(process.cwd(), 'data', targetMapName);

        this.dataSeeder.selectDataFile(seedFileName);
        const seedData = await this.dataSeeder.getSeedFile();

        if (!seedData || seedData.length === 0) {
            console.log("Aucune donnée à insérer.");
            return { success: false, count: 0 };
        }

        let collection = new HashMap<string, any>();
        
        collection.setStorageFile(targetFilePath);        
        await collection.onStart(); // Restaure le cache existant s'il y en a un

        await this.seedLoop(seedData, collection);

        return { success: true, count: seedData.length };
    }

    private async seedLoop(seedData: any[], map: HashMap<string, any>) {
        console.log(`Début de l'insertion de ${seedData.length} éléments...`);
        
        for (const item of seedData) {
            if (item && item.key !== undefined) {
                await map.insert({ key: String(item.key), value: item.value });
            }
        }
        
        await map.saveToDisk();
        
        console.log("Insertion terminée avec succès !");
    }
}