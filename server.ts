import Fastify from 'fastify';
import cors from '@fastify/cors';
import { promises as fs } from 'fs';
import path from 'path';
import fastifyStatic from '@fastify/static';

import HashMap from './src/services/hashmap.service';
import DataStorage from './src/services/data-storage.service';
import DataSeeder from './src/services/data-seed-storage.service';
import InsertionWorker from './src/worker/insertion.worker';
import { MyHashMapController } from './src/controllers/hashmap-controllers';

const fastify = Fastify({
    logger: true
});

async function main() {
    fastify.register(cors, { origin: true });

    fastify.register(fastifyStatic, {
        root: path.join(process.cwd(), 'src', 'UI'),
        prefix: '/UI/',
        index: 'index.html'
    });

    let insertionWorker = new InsertionWorker();
    let dataSeeder = new DataSeeder();
    const cache = new HashMap<string, string>();
    
    await cache.onStart();

    const hashMapController = MyHashMapController(cache);

    fastify.get('/UI', (request, reply) => {
        reply.redirect('/UI/');
    });

    fastify.get('/', async function() {
        return { status: 'OK\n' };
    });

    fastify.get('/keys', hashMapController.getAll);
    fastify.get('/keys/:key', hashMapController.getOne);
    fastify.post('/keys', hashMapController.create);
    fastify.put('/keys/:key', hashMapController.update);
    fastify.delete('/keys/:key', hashMapController.remove);

    fastify.get('/api/files', async (request, reply) => {
        let storage = new DataStorage();
        return await storage.listStore();
    });

    fastify.get('/api/files/:name', async (request, reply) => {
        const { name } = request.params as { name: string };
        const filePath = path.join(process.cwd(), 'data', name);
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(fileContent || "[]");
        } catch (error) {
            return reply.code(404).send({ error: "Fichier introuvable" });
        }
    });

    fastify.delete('/api/files/:name', async (request, reply) => {
        const { name } = request.params as { name: string };
        let storage = new DataStorage();
        await storage.deleteDataFile(name);
        return { success: true };
    });

    fastify.post('/api/files', async (request, reply) => {
        const { filename } = request.body as { filename: string };
        const dataDir = path.join(process.cwd(), 'data');
        const filePath = path.join(dataDir, filename);
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(Array(8).fill(null)), "utf-8");
        return { success: true };
    });

    fastify.post('/api/insert', async (request, reply) => {
        const { filename, key, value } = request.body as { filename: string, key: string, value: any };
        let map = new HashMap<string, any>();
        const targetFilePath = path.join(process.cwd(), 'data', filename);
        
        map.setStorageFile(targetFilePath);    
        await map.onStart(); 
        await map.insert({ key, value });
        return { success: true };
    });

    fastify.get('/data-seeder', async function (request, reply){
        const query = request.query as { numberOfInsertion: string };
        const numberOfInsertion = parseInt(query.numberOfInsertion, 10);

        dataSeeder.selectDataFile("init.json");
        const result = await dataSeeder.seedFile(numberOfInsertion);

        if(result) return { success: true };
        else return { success: false }; 
    });

    fastify.get('/seed', async function (request, reply) {
        try {
            const result = await insertionWorker.processSeeding();
            
            if (result.success) {
                return { success: true, message: `${result.count} entrées insérées avec succès.` };
            } else {
                return { success: false, message: "Rien n'a été inséré." };
            }
        } catch (error) {
            console.error("Erreur fatale lors du seeding :", error);
            return reply.code(500).send({ success: false, error: "Erreur serveur" });
        }
    });

    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Serveur lancé sur http://127.0.0.1:3001`);
}

main().catch((err) => {
    console.error(err, "\n");
    process.exit(1);
});