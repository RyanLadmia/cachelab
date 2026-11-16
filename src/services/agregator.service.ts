import HashMap from "./hashmap.service";
import DataStorage from "./data-storage.service";
import path from "path";
import { Bucket, HashmapValue } from "../types/hashmap.types";

interface ManagedCollection<K extends PropertyKey, V> {
    map: HashMap<K, V>;
    isPersistent: boolean;
    storage: DataStorage;
    unsavedInsertions: number;
}

export default class Aggregator<K extends PropertyKey, V> {
    
    private collections: Record<string, ManagedCollection<K, V>> = {};
    private readonly BATCH_SAVE_LIMIT = 500;

    public createCollection(name: string, isPersistent: boolean): HashMap<K, V> {
        if (this.collections[name]) {
            throw new Error(`La collection ${name} existe déjà dans l'agrégateur.`);
        }

        const storage = new DataStorage();
        if (isPersistent) {
            const targetFilePath = path.join(process.cwd(), 'data', `${name}.json`);
            storage.selectDataFile(targetFilePath);
        }

        this.collections[name] = {
            map: new HashMap<K, V>(),
            isPersistent,
            storage,
            unsavedInsertions: 0
        };
        
        console.log(`Collection [${name}] initialisée. Persistance : ${isPersistent}`);
        return this.collections[name].map;
    }

    public async loadCollectionFromFile(name: string): Promise<HashMap<K, V>> {
        this.createCollection(name, true);
        const managed = this.collections[name];
        
        const parsedData = await managed.storage.load();
        if (parsedData) {
            managed.map.loadRawData(parsedData as Bucket<K, V>[]);
        }
        return managed.map;
    }

    public getCollection(name: string): HashMap<K, V> {
        const managed = this.collections[name];
        if (!managed) throw new Error(`La collection ${name} est introuvable.`);
        return managed.map;
    }

    public async insert(name: string, item: HashmapValue<K, V>): Promise<void> {
        const managed = this.collections[name];
        if (!managed) throw new Error(`La collection ${name} est introuvable.`);

        managed.map.insert(item); 

        if (managed.isPersistent) {
            managed.unsavedInsertions++;
            if (managed.unsavedInsertions >= this.BATCH_SAVE_LIMIT) {
                await this.saveCollection(name);
            }
        }
    }

    public async insertMany(name: string, items: HashmapValue<K, V>[]): Promise<void> {
        const managed = this.collections[name];
        if (!managed) throw new Error(`La collection ${name} est introuvable.`);

        for (const item of items) {
            managed.map.insert(item);
        }

        if (managed.isPersistent) {
            managed.unsavedInsertions = 0;
            await this.saveCollection(name);
        }
    }

    public async update(name: string, key: K, newValue: V): Promise<boolean> {
        const managed = this.collections[name];
        if (!managed) throw new Error(`La collection ${name} est introuvable.`);

        const isUpdated = managed.map.updateKeyValue(key, newValue);
        
        if (isUpdated && managed.isPersistent) {
            await this.saveCollection(name);
        }
        return isUpdated;
    }

    public async delete(name: string, key: K): Promise<boolean> {
        const managed = this.collections[name];
        if (!managed) throw new Error(`La collection ${name} est introuvable.`);

        const isDeleted = managed.map.deleteKey(key);
        
        if (isDeleted && managed.isPersistent) {
            await this.saveCollection(name);
        }
        return isDeleted;
    }

    public async saveCollection(name: string): Promise<void> {
        const managed = this.collections[name];
        if (!managed || !managed.isPersistent) return;

        await managed.storage.save(managed.map.rawData);
        
        if (managed.unsavedInsertions > 0) {
            console.log(`[Batch/Sync] Collection [${name}] sauvegardée sur disque.`);
        }
        managed.unsavedInsertions = 0;
    }
}