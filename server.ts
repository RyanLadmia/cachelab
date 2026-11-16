import Fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'path';
import fastifyStatic from '@fastify/static';

import Aggregator from './src/services/agregator.service';
import DataStorage from './src/services/data-storage.service';
import DataSeeder from './src/services/data-seed-storage.service';
import InsertionWorker from './src/worker/insertion.worker';
import LoadTestService from './src/services/load-test.service';
import { MyHashMapController } from './src/controllers/hashmap.controllers';
import { LoadTestController } from './src/controllers/load-test.controller';
import { DataSeedController } from './src/controllers/data-seed.controller';
import { DataStorageController } from './src/controllers/data-storage.controller';

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

    // --- INITIALISATION DES SERVICES (Architecture Aggregator) ---
    const dataSeeder = new DataSeeder();
    const aggregator = new Aggregator<string, any>();
    const storage = new DataStorage();
    
    const insertionWorker = new InsertionWorker(aggregator, dataSeeder);
    
    await aggregator.loadCollectionFromFile('cache');

    const hashMapController = MyHashMapController(aggregator);
    const loadTestService = new LoadTestService(aggregator);
    const loadTestController = LoadTestController(loadTestService);
    const dataSeedController = DataSeedController(dataSeeder, insertionWorker);
    const dataStorageController = DataStorageController(storage, aggregator);

    fastify.get('/UI', (request, reply) => {
        reply.redirect('/UI/');
    });
    
    fastify.get('/', async function(_request, reply) {
        return reply.redirect('/UI/');
    });

    fastify.get('/health', async function() {
        return { status: 'OK' };
    });

    // --- ROUTES HASHMAP / AGGREGATOR (Dynamiques) ---
    fastify.get('/api/:collection/buckets', hashMapController.getBuckets);
    fastify.get('/api/:collection/keys', hashMapController.getAll);
    fastify.get('/api/:collection/keys/:key', hashMapController.getOne);
    fastify.post('/api/:collection/keys', hashMapController.create);
    fastify.put('/api/:collection/keys/:key', hashMapController.update);
    fastify.delete('/api/:collection/keys/:key', hashMapController.remove);
    
    // Route(s) de nettoyage mémoire issue de origin/UI
    fastify.delete('/api/memory', hashMapController.clear);
    fastify.delete('/api/:collection/memory', hashMapController.clear); // Version dynamique

    fastify.post('/api/collections', async (request, reply) => {
        const { name, isPersistent } = request.body as { name: string, isPersistent: boolean };
        try {
            aggregator.createCollection(name, isPersistent);
            return { success: true, message: `Collection [${name}] initialisée avec succès.` };
        } catch (error) {
            return reply.code(400).send({ error: error instanceof Error ? error.message : "Erreur création" });
        }
    });

    // --- ROUTES FICHIERS & INSERTION (Issues de origin/UI) ---
    fastify.get('/api/files', dataStorageController.list);
    fastify.get('/api/files/:name', dataStorageController.getOne);
    fastify.delete('/api/files/:name', dataStorageController.remove);
    fastify.post('/api/files', dataStorageController.create);
    fastify.post('/api/insert', dataStorageController.insert);

    // --- ROUTES SEEDER (Issues de origin/UI) ---
    fastify.get('/api/seeds', dataSeedController.listSeeds); 
    fastify.get('/data-seeder', dataSeedController.seedFile);
    fastify.get('/seed', dataSeedController.processSeed);

    // --- ROUTES LOAD TESTING (Issues de origin/UI) ---
    fastify.post('/api/load-test', loadTestController.run);

    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Serveur lancé sur http://127.0.0.1:3001`);
}

main().catch((err) => {
    console.error(err, "\n");
    process.exit(1);
});