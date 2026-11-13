import path from "path";
import { promises as fs } from "fs";

export default class DataStorage {
    public DATA_DIR = path.join(process.cwd(), "data");
    public DATA_FILE = path.join(this.DATA_DIR, "cache.json"); // by default

    async ensureStore() {
        await fs.mkdir(this.DATA_DIR, { recursive: true }); 
        try {
            await fs.access(this.DATA_FILE);
        } catch {
            await fs.writeFile(this.DATA_FILE, JSON.stringify(Array(8).fill(null)), "utf-8");
        }
    }
    // pour changer de hashmap
    selectDataFile(value: string){
        this.DATA_FILE = value
    }

    // load le current hashmap
    async load(): Promise<unknown[] | null> {
        await this.ensureStore();

        const file = await fs.readFile(this.DATA_FILE, "utf-8");
        if (!file.trim()) {
            return null; // return null if file doesn't exists
        }
        return JSON.parse(file);
    }

    // Save collection to the current JSON file
    async save(collection: unknown[]): Promise<void> {
        await this.ensureStore();

        await fs.writeFile(this.DATA_FILE, JSON.stringify(collection), "utf-8");
    }

    
    async listStore(){
        await fs.mkdir(this.DATA_DIR, { recursive: true }); 

        let fileList: string[] = [];
        try {
            const files = await fs.readdir(this.DATA_DIR)
            console.log(files, 'avant traitement')

            files.forEach(file => {
                fileList.push(file)
                console.log(file);
            });
            
            console.log(fileList,"list des fichiers après traitement")
            
        } catch (error) {
            
        }
    }

    async deleteDataFile(value: string) {
        const fileToDelete = path.join(this.DATA_DIR, value);

        try {
            await fs.unlink(fileToDelete); // delete file
            console.log(`Le fichier ${value} a été supprimé`);
            
            if (this.DATA_FILE === fileToDelete) {
                this.DATA_FILE = path.join(this.DATA_DIR, "cache.json"); // back to default cache
                // or reset the value to ""
            }
        } catch (error) {
            console.error(`Impossible de supprimer le fichier ${value} :`, error);
        }
    }
}