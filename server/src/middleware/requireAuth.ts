import type { FastifyRequest, FastifyReply } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.session.userId) {
    reply.code(401).send({ error: 'Not authenticated' })
  }
}
