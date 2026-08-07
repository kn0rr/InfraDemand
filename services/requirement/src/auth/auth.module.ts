import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RollenGuard } from "./rollen.guard";

@Module({
  imports: [PassportModule],
  providers: [
    JwtStrategy,
    // Die Reihenfolge ist bindend: JwtAuthGuard setzt request.user, den RollenGuard
    // liest. Umgekehrt registriert liefe die Rollenpruefung gegen eine leere Liste und
    // wiese jede Anfrage ab.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RollenGuard },
  ],
})
export class AuthModule {}
