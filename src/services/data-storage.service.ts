import path from "path";
import { promises as fs } from "fs";


export default class DataStorage {
    // Backup folder name
    public DATA_DIR = path.join(process.cwd(), "data"); // ok 
    // Backup file name
    public DATA_FILE = path.join(this.DATA_DIR, "cache.json"); // par défaut 

    // Check if Folder data and cache.json file exists
    async ensureStore() {
        await fs.mkdir(this.DATA_DIR, { recursive: true }); // avoid error if data folder doesn't exists
        try {
            await fs.access(this.DATA_FILE);
        } catch {
            await fs.writeFile(this.DATA_FILE, JSON.stringify(Array(8).fill(null)), "utf-8");
        }
    }

    selectDataFile(value: string){
        this.DATA_FILE = value
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
            await fs.unlink(fileToDelete); // suppr
            console.log(`Le fichier ${value} a été supprimé`);
            
            if (this.DATA_FILE === fileToDelete) {
                this.DATA_FILE = path.join(this.DATA_DIR, "cache.json"); // on revient au cache par defaut 
                // ou alors on pourrait reset la value a ""
            }
        } catch (error) {
            console.error(`Impossible de supprimer le fichier ${value} :`, error);
        }
    }
}