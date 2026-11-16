import { promises as fs } from "fs";
import path from "path";
import { FastifyReply, FastifyRequest } from "fastify";
import DataStorage from "../services/data-storage.service";
import HashMap from "../services/hashmap.service";

type FileNameParams = { name: string };
type CreateFileBody = { filename: string };
type InsertBody = { filename: string; key: string; value: any };

export function DataStorageController(storage: DataStorage) {
    return {
        list: async function () {
            return await storage.listStore();
        },

        getOne: async function (
            request: FastifyRequest<{ Params: FileNameParams }>,
            reply: FastifyReply
        ) {
            const { name } = request.params;
            const filePath = path.join(process.cwd(), "data", name);

            try {
                const fileContent = await fs.readFile(filePath, "utf-8");
                return JSON.parse(fileContent || "[]");
            } catch (error) {
                return reply.code(404).send({ error: "Fichier introuvable" });
            }
        },

        remove: async function (
            request: FastifyRequest<{ Params: FileNameParams }>
        ) {
            await storage.deleteDataFile(request.params.name);
            return { success: true };
        },

        create: async function (
            request: FastifyRequest<{ Body: CreateFileBody }>
        ) {
            const { filename } = request.body;
            const dataDir = path.join(process.cwd(), "data");
            const filePath = path.join(dataDir, filename);

            await fs.mkdir(dataDir, { recursive: true });
            await fs.writeFile(
                filePath,
                JSON.stringify(Array(8).fill(null)),
                "utf-8"
            );

            return { success: true };
        },

        insert: async function (
            request: FastifyRequest<{ Body: InsertBody }>
        ) {
            const { filename, key, value } = request.body;
            const map = new HashMap<string, any>();
            const targetFilePath = path.join(process.cwd(), "data", filename);

            map.setStorageFile(targetFilePath);
            await map.onStart();
            await map.insert({ key, value });

            return { success: true };
        },
    };
}
