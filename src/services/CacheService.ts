import { MyCollection } from "../model/CollectionType";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { stringify } from "querystring";


// To type
type HashmapValue<K extends PropertyKey, V> = {
    key: K;
    value: V;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "cache.json");

// Check if Folder data and cache.json file exists
async function ensureStore() {
    await fs.mkdir(DATA_DIR, { recursive: true}); // avoid error if data folder doesn't exists
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile( DATA_FILE, JSON.stringify(Array(8).fill(undefined)), "utf-8");
    }
}

//define class 
export default class HashMap<K extends PropertyKey, V>{
    private collection: MyCollection<HashmapValue<K, V>> = Array(8).fill(undefined)
    private loadFactor = 0.75;

    async load() {
        await ensureStore();
        const file = await fs.readFile(DATA_FILE, "utf-8");
        if (!file.trim()) return;
        this.collection = JSON.parse(file);
    }

     async insert(newValue: HashmapValue<K, V>) {
        // Check data folder and cache.json exists
        await ensureStore();

        // Get the key
        const key = String(newValue.key);
        console.log(key, 'key');

        // Hash the key
        const hash = createHash('sha256').update(key);        
        console.log(hash, "hash");
        // Convert hash to hexadecimal
        const hashHex = hash.digest("hex");
        console.log(hashHex, "hashhex");

        // Convert 8 first hex caracters to int
        // total is 10 due to base int16, wich counter out of 16 and not of 10, which add 2 symbols with parsin at the end 
        const hashToInt = parseInt(hashHex.slice(0, 8), 16); 
        console.log(hashToInt);

        // Calculate index
        const index = hashToInt % this.collection.length;
        console.log(index);

        this.collection[index] = newValue

        // Edit the cache.json file
        await fs.writeFile(
            DATA_FILE,
            JSON.stringify(this.collection, null, 2),
            "utf-8"
        );

        console.log(this.collection, "lolol")
    }
}