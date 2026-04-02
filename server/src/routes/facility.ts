import { FastifyPluginAsync } from 'fastify';
import { authenticate, requireRole } from '../middleware/authenticate';
import { FacilityController } from '../controllers/facility.controller';

const facilityRoutes: FastifyPluginAsync = async (fastify) => {
  /** GET /api/facilities — list all active facilities (public) */
  fastify.get('/', FacilityController.list);

  /** GET /api/facilities/:id — get facility details (public) */
  fastify.get('/:id', FacilityController.getById);

  /** GET /api/facilities/:id/slots — slots for a date (public) */
  fastify.get('/:id/slots', FacilityController.getSlots);

  /** POST /api/facilities — create facility (ADMIN only) */
  fastify.post(
    '/',
    { preHandler: [authenticate, requireRole('ADMIN')] },
    FacilityController.create,
  );

  /** PATCH /api/facilities/:id — update facility (ADMIN only) */
  fastify.patch(
    '/:id',
    { preHandler: [authenticate, requireRole('ADMIN')] },
    FacilityController.update,
  );
};

export default facilityRoutes;
