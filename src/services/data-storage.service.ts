import path from "path";
import { promises as fs } from "fs";

// Persistent file for cache
export default class DataStorage {
    // Backup folder name
    public DATA_DIR = path.join(process.cwd(), "data");
    // Backup file name
    public DATA_FILE = path.join(this.DATA_DIR, "cache.json"); // by default

    // Check if Folder data and cache.json file exists and create them if needed
    async ensureStore() {
        await fs.mkdir(this.DATA_DIR, { recursive: true }); // avoid error if data folder doesn't exists
        try {
            await fs.access(this.DATA_FILE);
        } catch {
            await fs.writeFile(this.DATA_FILE, JSON.stringify(Array(8).fill(null)), "utf-8");
        }
    }

    // Switch the active storage file (fot later with multiple stores)
    selectDataFile(value: string){
        this.DATA_FILE = value
    }

    // Load and pase the current Json store
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

        await fs.writeFile(this.DATA_FILE, JSON.stringify(collection, null, 2), "utf-8"
        );
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