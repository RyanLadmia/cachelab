// aggregator.service.ts
import HashMap from "./hashmap.service";
import CollectionIterator from "../iterators/CollectionIterator";
import path from "path";
import { Bucket } from "../types/hashmap.types";

export default class Aggregator<K extends PropertyKey, V> {
    
    // Un dictionnaire contenant toutes nos collections instanciées
    private collections: Record<string, HashMap<K, V>> = {};

    /**
     * Initialise une collection de 0 en RAM (avec ou sans persistance)
     */
    public createCollection(name: string, isPersistent: boolean): HashMap<K, V> {
        if (this.collections[name]) {
            throw new Error(`La collection ${name} existe déjà dans l'agrégateur.`);
        }

        const newMap = new HashMap<K, V>(isPersistent);
        
        // Si elle est persistante, on lui attribue un fichier dédié
        if (isPersistent) {
            const targetFilePath = path.join(process.cwd(), 'data', `${name}.json`);
            newMap.setStorageFile(targetFilePath);
        }

        this.collections[name] = newMap;
        console.log(`Collection [${name}] créée. Persistance : ${isPersistent}`);
        
        return newMap;
    }

    /**
     * Initialise une collection à partir d'un fichier existant
     */
    public async loadCollectionFromFile(name: string): Promise<HashMap<K, V>> {
        // Une collection chargée depuis un fichier est persistante par défaut
        const newMap = this.createCollection(name, true);
        await newMap.onStart(); // Déclenche la lecture du fichier
        return newMap;
    }

    /**
     * Récupère une collection existante
     */
    public getCollection(name: string): HashMap<K, V> {
        const collection = this.collections[name];
        if (!collection) {
            throw new Error(`La collection ${name} est introuvable.`);
        }
        return collection;
    }

    /**
     * Distribue l'itérateur d'une collection spécifique
     */
    public getCollectionIterator(name: string): CollectionIterator<Bucket<K, V>> {
        const collection = this.getCollection(name);
        return collection.getIterator();
    }
}