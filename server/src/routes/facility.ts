import { FastifyPluginAsync } from 'fastify';
import { authenticate, requireRole } from '../middleware/authenticate';

const facilityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/facilities
   * Public — list all active facilities
   */
  fastify.get('/', async (request, reply) => {
    // TODO: FacilityController.list
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/facilities/:id
   * Public — get facility details + available slots
   */
  fastify.get('/:id', async (request, reply) => {
    // TODO: FacilityController.getById
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/facilities/:id/slots
   * Public — get slots for a facility on a given date
   * Query: ?date=YYYY-MM-DD&availableOnly=true
   */
  fastify.get('/:id/slots', async (request, reply) => {
    // TODO: SlotController.getByFacility
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/facilities — Admin only
   */
  fastify.post(
    '/',
    { preHandler: [authenticate, requireRole('ADMIN')] },
    async (request, reply) => {
      // TODO: FacilityController.create
      return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
    },
  );

  /**
   * PATCH /api/facilities/:id — Admin only
   */
  fastify.patch(
    '/:id',
    { preHandler: [authenticate, requireRole('ADMIN')] },
    async (request, reply) => {
      // TODO: FacilityController.update
      return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
    },
  );
};

export default facilityRoutes;
