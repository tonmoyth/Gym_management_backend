import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";

const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "") // remove special characters
        .replace(/[\s-]+/g, "-") // replace spaces and multiple hyphens with a single hyphen
        .replace(/^-+|-+$/g, ""); // remove leading and trailing hyphens
};

const toTitleCase = (text: string): string => {
    return text
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

const createSpecializationTag = async (payload: { name: string }) => {
    const trimmedName = payload.name.trim();
    const titleCasedName = toTitleCase(trimmedName);

    // Check duplicate name (case-insensitive)
    const existingTag = await prisma.specializationTag.findFirst({
        where: {
            name: {
                equals: titleCasedName,
                mode: "insensitive",
            },
        },
    });

    if (existingTag) {
        return {
            id: existingTag.id,
            name: existingTag.name,
            slug: existingTag.slug,
            createdAt: existingTag.createdAt,
        };
    }

    // Generate unique slug
    const baseSlug = generateSlug(titleCasedName);
    let slug = baseSlug;
    let isSlugUnique = false;
    let slugCounter = 2;

    while (!isSlugUnique) {
        const existingBySlug = await prisma.specializationTag.findUnique({
            where: { slug },
        });

        if (!existingBySlug) {
            isSlugUnique = true;
        } else {
            slug = `${baseSlug}-${slugCounter}`;
            slugCounter++;
        }
    }

    // Create SpecializationTag
    const newTag = await prisma.specializationTag.create({
        data: {
            name: titleCasedName,
            slug,
        },
        select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
        },
    });

    return newTag;
};

const getAllSpecializationTags = async () => {
    const tags = await prisma.specializationTag.findMany({
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
        },
    });

    return tags;
};

export const SpecializationTagService = {
    createSpecializationTag,
    getAllSpecializationTags,
};
