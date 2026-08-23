import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";

const createEquipment = async (ownerId: string, businessId: string, payload: any) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const equipment = await prisma.equipment.create({
    data: {
      businessId,
      name: payload.name,
      quantity: payload.quantity,
      condition: payload.condition,
      lastMaintenanceDate: payload.lastMaintenanceDate ? new Date(payload.lastMaintenanceDate) : null,
    },
  });

  return equipment;
};

const getEquipmentList = async (ownerId: string, businessId: string, query: any) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const queryBuilder = new QueryBuilder(prisma.equipment, query, {
    searchableFields: ["name"],
  })
    .search()
    .filter()
    .where({ businessId })
    .sort()
    .paginate();

  const [total, result] = await Promise.all([
    queryBuilder.count(),
    queryBuilder.execute(),
  ]);

  const formattedData = result.data.map((item: any) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    condition: item.condition,
    lastMaintenanceDate: item.lastMaintenanceDate,
    createdAt: item.createdAt,
  }));

  return {
    meta: {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(query.limit) || 10)),
    },
    data: formattedData,
  };
};

const updateEquipment = async (ownerId: string, businessId: string, id: string, payload: any) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const equipment = await prisma.equipment.findUnique({ where: { id } });
  if (!equipment) throw new AppError(404, "Equipment not found.");
  if (equipment.businessId !== businessId) throw new AppError(403, "Equipment does not belong to this business.");

  const updateData: any = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.quantity !== undefined) updateData.quantity = payload.quantity;
  if (payload.condition !== undefined) updateData.condition = payload.condition;
  if (payload.lastMaintenanceDate !== undefined) {
    updateData.lastMaintenanceDate = payload.lastMaintenanceDate ? new Date(payload.lastMaintenanceDate) : null;
  }

  const updatedEquipment = await prisma.equipment.update({
    where: { id },
    data: updateData,
  });

  return updatedEquipment;
};

const deleteEquipment = async (ownerId: string, businessId: string, id: string) => {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new AppError(404, "Business not found.");
  if (business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not own this business.");

  const equipment = await prisma.equipment.findUnique({ where: { id } });
  if (!equipment) throw new AppError(404, "Equipment not found.");
  if (equipment.businessId !== businessId) throw new AppError(403, "Equipment does not belong to this business.");

  await prisma.equipment.delete({ where: { id } });

  return null;
};

export const EquipmentService = {
  createEquipment,
  getEquipmentList,
  updateEquipment,
  deleteEquipment,
};
