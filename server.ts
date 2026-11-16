import Fastify from 'fastify';
import cors from '@fastify/cors';
import { promises as fs } from 'fs';
import path from 'path';
import fastifyStatic from '@fastify/static';

import Aggregator from './src/services/agregator.service';
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

    // bloc d'initialisation  

    const dataSeeder = new DataSeeder();
    const aggregator = new Aggregator<string, any>();
    
    const insertionWorker = new InsertionWorker(aggregator, dataSeeder);
    const hashMapController = MyHashMapController(aggregator);

    await aggregator.loadCollectionFromFile('cache');

    fastify.get('/UI', (request, reply) => {
        reply.redirect('/UI/');
    });
    
    fastify.get('/', async function(_request, reply) {
        return reply.redirect('/UI/');
    });

    fastify.get('/health', async function() {
        return { status: 'OK' };
    });

    fastify.get('/api/:collection/buckets', hashMapController.getBuckets);
    fastify.get('/api/:collection/keys', hashMapController.getAll);
    fastify.get('/api/:collection/keys/:key', hashMapController.getOne);
    fastify.post('/api/:collection/keys', hashMapController.create);
    fastify.put('/api/:collection/keys/:key', hashMapController.update);
    fastify.delete('/api/:collection/keys/:key', hashMapController.remove);

    fastify.post('/api/collections', async (request, reply) => {
        const { name, isPersistent } = request.body as { name: string, isPersistent: boolean };
        try {
            aggregator.createCollection(name, isPersistent);
            return { success: true, message: `Collection [${name}] initialisée avec succès.` };
        } catch (error) {
            return reply.code(400).send({ error: error instanceof Error ? error.message : "Erreur création" });
        }
    });

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

    fastify.post('/api/insert', async (request, reply) => {
        const { filename, key, value } = request.body as { filename: string, key: string, value: any };
        
        try {
            aggregator.getCollection(filename);
        } catch {
            await aggregator.loadCollectionFromFile(filename);
        }
        
        await aggregator.insert(filename, { key, value });
        return { success: true };
    });

    fastify.get('/data-seeder', async function (request, reply){
        const query = request.query as { numberOfInsertion: string };
        const numberOfInsertion = parseInt(query.numberOfInsertion, 10);

        dataSeeder.selectDataFile("init.json");
        const result = await dataSeeder.seedFile(numberOfInsertion);

        return { success: result };
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