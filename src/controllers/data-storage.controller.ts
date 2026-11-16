import { FastifyReply, FastifyRequest } from "fastify";
import DataStorage from "../services/data-storage.service";
import Aggregator from "../services/agregator.service";
import path from "path";
import { promises as fs } from "fs";

type NameParams = { name: string };
type CreateFileBody = { filename: string };
type InsertBody = { filename: string; key: string; value: any };

export function DataStorageController(storage: DataStorage, aggregator: Aggregator<string, any>) {
    return {
        list: async function (request: FastifyRequest, reply: FastifyReply) {
            return await storage.listStore();
        },

        getOne: async function (request: FastifyRequest<{ Params: NameParams }>, reply: FastifyReply) {
            const { name } = request.params;
            const filePath = path.join(process.cwd(), 'data', name);
            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(fileContent || "[]");
            } catch (error) {
                return reply.code(404).send({ error: "Fichier introuvable" });
            }
        },

        remove: async function (request: FastifyRequest<{ Params: NameParams }>, reply: FastifyReply) {
            const { name } = request.params;
            await storage.deleteDataFile(name);
            return { success: true };
        },

        create: async function (request: FastifyRequest<{ Body: CreateFileBody }>, reply: FastifyReply) {
            const { filename } = request.body;
            const dataDir = path.join(process.cwd(), 'data');
            const filePath = path.join(dataDir, filename);
            await fs.mkdir(dataDir, { recursive: true });
            // Crée un fichier de base avec 8 buckets vides
            await fs.writeFile(filePath, JSON.stringify(Array(8).fill(null)), "utf-8");
            return { success: true };
        },

        insert: async function (request: FastifyRequest<{ Body: InsertBody }>, reply: FastifyReply) {
            const { filename, key, value } = request.body;
            
            try {
                aggregator.getCollection(filename);
            } catch {
                await aggregator.loadCollectionFromFile(filename);
            }
            
            await aggregator.insert(filename, { key, value });
            return { success: true };
        }
    };
}