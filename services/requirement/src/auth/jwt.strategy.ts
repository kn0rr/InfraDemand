import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { passportJwtSecret } from "jwks-rsa";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface JwtPayload {
  sub: string;
  azp?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  tenants?: string[];
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  /** Client, der das Token angefordert hat (azp). Grundlage von change_source. */
  clientId: string;
  roles: string[];
  /**
   * Mandanten, denen dieser Anwender angehoert (ADR-0017 C2, ADR-0026 Punkt 6).
   *
   * Nur ein Anspruch aus dem Token - es gibt keine Liste gueltiger Mandanten, gegen die
   * geprueft werden koennte. Woher der Anspruch stammt, entscheidet M6.
   */
  tenants: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const issuer = configService.getOrThrow<string>("KEYCLOAK_ISSUER_URL");
    const audience = configService.getOrThrow<string>("KEYCLOAK_AUDIENCE");

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Ohne diese Einschraenkung wird der im Token angegebene Algorithmus akzeptiert
      // (Algorithmus-Verwechslung). Die Zeile darf nicht entfallen.
      algorithms: ["RS256"],
      issuer,
      audience,
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `${issuer}/protocol/openid-connect/certs`,
        cache: true,
        cacheMaxAge: 600_000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      username: payload.preferred_username ?? payload.sub,
      clientId: payload.azp ?? "unbekannt",
      roles: payload.realm_access?.roles ?? [],
      tenants: payload.tenants ?? [],
    };
  }
}
