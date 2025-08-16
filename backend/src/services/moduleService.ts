// backend/src/services/moduleService.ts
import prisma from "./prismaService.js"

export async function createModule(data: {
  id: string
  title: string
  videoKey: string
  status: string
}) {
  return prisma.module.create({ data })
}

export async function updateModule(id: string, data: any) {
  return prisma.module.update({
    where: { id },
    data,
  })
}

export async function getModule(id: string) {
  return prisma.module.findUnique({ where: { id } })
}
