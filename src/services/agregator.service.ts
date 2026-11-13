// aggregator.service.ts
import HashMap from "./hashmap.service";
import CollectionIterator from "../iterators/CollectionIterator";
import path from "path";
import { Bucket } from "../types/hashmap.types";

export default class Aggregator<K extends PropertyKey, V> {
    
    private collections: Record<string, HashMap<K, V>> = {};

    public createCollection(name: string, isPersistent: boolean): HashMap<K, V> {
        if (this.collections[name]) {
            throw new Error(`La collection ${name} existe déjà dans l'agrégateur.`);
        }

        const newMap = new HashMap<K, V>(isPersistent);
        
        if (isPersistent) {
            const targetFilePath = path.join(process.cwd(), 'data', `${name}.json`);
            newMap.setStorageFile(targetFilePath);
        }

        this.collections[name] = newMap;
        console.log(`Collection [${name}] créée. Persistance : ${isPersistent}`);
        
        return newMap;
    }

    public async loadCollectionFromFile(name: string): Promise<HashMap<K, V>> {
        const newMap = this.createCollection(name, true);
        await newMap.onStart(); // Déclenche la lecture du fichier
        return newMap;
    }

    public getCollection(name: string): HashMap<K, V> {
        const collection = this.collections[name];
        if (!collection) {
            throw new Error(`La collection ${name} est introuvable.`);
        }
        return collection;
    }

    public getCollectionIterator(name: string): CollectionIterator<Bucket<K, V>> {
        const collection = this.getCollection(name);
        return collection.getIterator();
    }
}