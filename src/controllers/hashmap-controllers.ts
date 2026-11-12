import { FastifyReply, FastifyRequest } from 'fastify' 
import HashMap from "../services/hashmap.service"

type KeyParams = { key: string }
type CreateBody = { key: string, value: string}
type UpdateBody = { value: string }

export function MyHashMapController(hashmap: HashMap<string, string>) {
    return {
        getAll: async function () {
            return hashmap.getAllKeys()
        },

        getOne: async function ( request: FastifyRequest<{Params: KeyParams}>, reply: FastifyReply) {
            const value = hashmap.getKeyValue(request.params.key);

            if (value === null) {
                return reply.code(404).send({ error: `Key "${request.params.key}" not found `})
            }
            return { key: request.params.key, value }
        },

        create: async function (request: FastifyRequest<{Body: CreateBody}>, reply: FastifyReply) {
            const { key, value } = request.body;

            if (!key) {
                return reply.code(400).send({error: 'Key is required'})
            }
            try {
                await hashmap.insert({key, value})
                return reply.code(201).send({key, value})
            } catch (error) {
                return reply.code(409).send({error: error instanceof Error ? error.message : 'Insertion failed'})
            }
        },

        update: async function (request: FastifyRequest<{Params: KeyParams, Body: UpdateBody}>, reply: FastifyReply) {
            const updated = await hashmap.updateKeyValue(request.params.key, request.body.value)
            
            if (!updated) {
                return reply.code(404).send({error: `Key "${request.params.key}" not found`})
            }
            return { key: request.params.key, value: request.body.value}
        },

        remove: async function (request: FastifyRequest<{ Params: KeyParams }>, reply: FastifyReply) {
            const deleted = await hashmap.deleteKey(request.params.key)

            if (!deleted) {
                return reply.code(404).send({error: `Key "${request.params.key}" not found`})
            }
            return { deleted: true, key: request.params.key}
        },
    }
}