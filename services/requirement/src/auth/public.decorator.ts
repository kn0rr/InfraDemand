import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Nimmt einen Endpunkt von der globalen Token-Pruefung aus.
 * Bewusst als Ausnahme gestaltet: Ohne diesen Dekorator ist jeder Endpunkt geschuetzt.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
