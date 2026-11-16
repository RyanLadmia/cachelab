import { FastifyReply, FastifyRequest } from 'fastify' 
import Aggregator from '../services/agregator.service'

type CollectionParams = { collection: string }
type KeyParams = { collection: string, key: string }
type CreateBody = { key: string, value: string }
type UpdateBody = { value: string }

// permet le CRUD de l'agrégateur 
export function MyHashMapController(aggregator: Aggregator<string, any>) {
    
    const getMapOrThrow = (collectionName: string) => {
        return aggregator.getCollection(collectionName);
    }; // getter, vu que y'a pas de this non plus

    return {
        getAll: async function (request: FastifyRequest<{Params: CollectionParams}>, reply: FastifyReply) {
            try {
                return getMapOrThrow(request.params.collection).getAllKeys();
            } catch (error) {
                return reply.code(404).send({ error: error instanceof Error ? error.message : 'Collection introuvable' });
            }
        },

        getBuckets: async function (request: FastifyRequest<{Params: CollectionParams}>, reply: FastifyReply) {
            try {
                return getMapOrThrow(request.params.collection).getBucketsSnapshot();
            } catch (error) {
                return reply.code(404).send({ error: error instanceof Error ? error.message : 'Collection introuvable' });
            }
        },

        getOne: async function (request: FastifyRequest<{Params: KeyParams}>, reply: FastifyReply) {
            try {
                const value = getMapOrThrow(request.params.collection).getKeyValue(request.params.key);
                if (value === null) {
                    return reply.code(404).send({ error: `Key "${request.params.key}" not found` });
                }
                return { key: request.params.key, value };
            } catch (error) {
                return reply.code(404).send({ error: error instanceof Error ? error.message : 'Collection introuvable' });
            }
        },

        create: async function (request: FastifyRequest<{Params: CollectionParams, Body: CreateBody}>, reply: FastifyReply) {
            const { key, value } = request.body;
            if (!key) return reply.code(400).send({error: 'Key is required'});
            
            try {
                await aggregator.insert(request.params.collection, {key, value});
                return reply.code(201).send({key, value});
            } catch (error) {
                return reply.code(409).send({error: error instanceof Error ? error.message : 'Insertion failed'});
            }
        },

        update: async function (request: FastifyRequest<{Params: KeyParams, Body: UpdateBody}>, reply: FastifyReply) {
            try {
                const updated = await aggregator.update(request.params.collection, request.params.key, request.body.value);
                if (!updated) {
                    return reply.code(404).send({error: `Key "${request.params.key}" not found`});
                }
                return { key: request.params.key, value: request.body.value };
            } catch (error) {
                return reply.code(404).send({ error: error instanceof Error ? error.message : 'Collection introuvable' });
            }
        },

        remove: async function (request: FastifyRequest<{ Params: KeyParams }>, reply: FastifyReply) {
            try {
                const deleted = await aggregator.delete(request.params.collection, request.params.key);
                if (!deleted) {
                    return reply.code(404).send({error: `Key "${request.params.key}" not found`});
                }
                return { deleted: true, key: request.params.key };
            } catch (error) {
                return reply.code(404).send({ error: error instanceof Error ? error.message : 'Collection introuvable' });
            }
        },

    clear: async function (request: FastifyRequest<{ Params: { collection?: string } }>, reply: FastifyReply) {
                try {
                    const collectionName = request.params.collection ?? "cache";
                    const hashmap = aggregator.getCollection(collectionName);
                    
                    hashmap.clearAll();
                    
                    await aggregator.saveCollection(collectionName);

                    return reply.code(200).send({ cleared: true, collection: collectionName });
                } catch (error) {
                    return reply.code(404).send({ error: error instanceof Error ? error.message : 'Collection introuvable' });
                }
            },
    }
}