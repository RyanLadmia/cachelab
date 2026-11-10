import Fastify from 'fastify';
import cors from '@fastify/cors';
import { promises as fs } from 'fs';
import path from 'path';
import fastifyStatic from '@fastify/static';

import HashMap from './src/services/hashmap.service';
import DataStorage from './src/services/data-storage.service';


const fastify = Fastify({
    logger: true
});

fastify.register(cors, {
    origin: true
});

fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'src', 'UI'),
    prefix: '/UI/',
    index: 'index.html'
});

fastify.get('/UI', (request, reply) => {
    reply.redirect('/UI/');
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
        
    const dataDirectory = path.join(process.cwd(), 'data');
    const targetFilePath = path.join(dataDirectory, filename);

    const storageService = (map as any).dataStorage;

    storageService.selectDataFile(targetFilePath);    

    await map.onStart(); 
    
    await map.insert({ key, value });
    
    return { success: true };
});

// route de test
fastify.get('/', async function (request, reply) {
    let toto = new HashMap<string, string>();
    await toto.onStart(); 
    
    await toto.insert({key: "name", value:"joris"});
    await toto.insert({key: "erlkjher", value:"joris"});
    await toto.insert({key: "hhhgjf", value:"joris"});
    await toto.insert({key: "bnbnb", value:"joris"});
    await toto.insert({key: "zzzz", value:"joris"});
    await toto.insert({key: "oooo", value:"joris"});
    
    return "Données par défaut insérées";
});

const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: "0.0.0.0" });
        fastify.log.info(`Serveur lancé sur http://127.0.0.1:3001`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();