import Fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'path';
import fastifyStatic from '@fastify/static';

import HashMap from './src/services/hashmap.service';
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

    let insertionWorker = new InsertionWorker();
    let dataSeeder = new DataSeeder();
    const storage = new DataStorage();
    const cache = new HashMap<string, string>();
    
    await cache.onStart();

    const hashMapController = MyHashMapController(cache);
    const loadTestService = new LoadTestService(cache);
    const loadTestController = LoadTestController(loadTestService);
    const dataSeedController = DataSeedController(dataSeeder, insertionWorker);
    const dataStorageController = DataStorageController(storage);

    fastify.get('/UI', (request, reply) => {
        reply.redirect('/UI/');
    });
    
    fastify.get('/', async function(_request, reply) {
        return reply.redirect('/UI/');
    });

    fastify.get('/health', async function() {
        return { status: 'OK' };
    });

    fastify.get('/buckets', hashMapController.getBuckets);
    fastify.get('/keys', hashMapController.getAll);
    fastify.get('/keys/:key', hashMapController.getOne);
    fastify.post('/keys', hashMapController.create);
    fastify.put('/keys/:key', hashMapController.update);
    fastify.delete('/keys/:key', hashMapController.remove);
    fastify.delete('/api/memory', hashMapController.clear);

    fastify.get('/api/files', dataStorageController.list);
    fastify.get('/api/files/:name', dataStorageController.getOne);
    fastify.delete('/api/files/:name', dataStorageController.remove);
    fastify.post('/api/files', dataStorageController.create);
    fastify.post('/api/insert', dataStorageController.insert);

    fastify.get('/data-seeder', dataSeedController.seedFile);
    fastify.get('/seed', dataSeedController.processSeed);

    fastify.post('/api/load-test', loadTestController.run);

    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Serveur lancé sur http://127.0.0.1:3001`);
}

main().catch((err) => {
    console.error(err, "\n");
    process.exit(1);
});