import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "./jwt.strategy";
import { ROLLEN_SCHLUESSEL } from "./rollen.decorator";

@Injectable()
export class RollenGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const verlangt = this.reflector.getAllAndOverride<string[] | undefined>(ROLLEN_SCHLUESSEL, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Ohne @Rollen bleibt es beim bisherigen Verhalten: angemeldet genuegt.
    if (verlangt === undefined || verlangt.length === 0) {
      return true;
    }

    const anfrage = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const vorhanden = anfrage.user?.roles ?? [];

    if (!verlangt.some((rolle) => vorhanden.includes(rolle))) {
      // Bewusst ohne Angabe der fehlenden Rolle - das waere ein Hinweis auf die
      // Rechtestruktur (PROD-034).
      throw new ForbiddenException("Fuer diese Operation fehlt die Berechtigung");
    }

    return true;
  }
}
