import { MyCollection } from "../model/CollectionType";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { stringify } from "querystring";


type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}

// Backup folder name
const DATA_DIR = path.join(process.cwd(), "data");
// Backup file name
const DATA_FILE = path.join(DATA_DIR, "cache.json");

// Check if Folder data and cache.json file exists
async function ensureStore() {
    await fs.mkdir(DATA_DIR, { recursive: true}); // avoid error if data folder doesn't exists
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile( DATA_FILE, JSON.stringify(Array(8).fill(null)), "utf-8");
    }
}

//define class 
export default class HashMap<K extends PropertyKey, V>{
    private collection: MyCollection<HashmapValue<K, V>> = Array(8).fill(null)
    private loadFactor = 0.75;
    private indexFactor;
    
    computeLoadFactor(){
        this.indexFactor = this.collection.length * this.loadFactor
    }

    // resature hashmap from cache.json
    async load() {
        await ensureStore();
        const file = await fs.readFile(DATA_FILE, "utf-8");
        if (!file.trim()) return;
        this.collection = JSON.parse(file);
    }

     async insert(newValue: HashmapValue<K, V>) {

        // Check data folder and cache.json exists
        await ensureStore();

        const key = String(newValue.key);
        const hash = createHash('sha256').update(key);        
        const hashHex = hash.digest("hex");
        // slice à 10 a cause de parseInt() 
        const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
        const index = hashToInt % this.collection.length;
        
        this.collisionManagement(index, newValue);

        // Edit the cache.json file
        await fs.writeFile(
            DATA_FILE,
            JSON.stringify(this.collection, null, 2),
            "utf-8"
        );

        console.table(this.collection)
        console.log("\n_________________________________________________________________________________________________________________________\n")
        return 0
    }

    async collisionManagement(index: number, newValue: HashmapValue<K, V>) {
        const currentBucket = this.collection[index];

        if (currentBucket !== null) {
            
            if (!Array.isArray(currentBucket)) {
                console.log("convertir to array");
                this.collection[index] = [currentBucket, newValue];
            } else {
                currentBucket.push(newValue);
            }
            
        } else {
            this.collection[index] = newValue;
        }
    }

    async verifyLoadFactor(){
    }
}