import { TokenVerifier } from "@parlor/cloudflare";

type AccessConfig = {
  issuer: string;
  audience: string;
  humans: string[];
  machine: { kind: "migration-verifier"; clientId: string };
};
const verifiers = new Map<string, TokenVerifier>();

/** Reuse Parlor's signature/JWKS/issuer/audience/time verifier, then pin identity. */
export async function operatorAllowed(
  request: Request,
  raw: unknown,
): Promise<boolean> {
  try {
    if (typeof raw !== "string") return false;
    const config = JSON.parse(raw) as AccessConfig;
    if (
      !config.issuer?.startsWith("https://") ||
      !config.audience ||
      !Array.isArray(config.humans) ||
      config.machine?.kind !== "migration-verifier" ||
      !config.machine.clientId
    )
      return false;
    const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!assertion || assertion.length > 16_384) return false;
    const cacheKey = `${config.issuer}|${config.audience}`;
    let verifier = verifiers.get(cacheKey);
    if (!verifier) {
      verifier = new TokenVerifier({
        providers: [
          {
            type: "customJwt",
            issuer: config.issuer,
            jwks: `${config.issuer}/cdn-cgi/access/certs`,
            algorithm: "RS256",
            applicationID: config.audience,
          },
        ],
      });
      verifiers.set(cacheKey, verifier);
    }
    const { identity, expiresAt } = await verifier.verify(assertion);
    if (identity.issuer !== config.issuer || expiresAt <= Date.now())
      return false;
    const claims = JSON.parse(
      Buffer.from(assertion.split(".")[1]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      typeof claims["iat"] !== "number" ||
      !Number.isFinite(claims["iat"]) ||
      claims["iat"] > Date.now() / 1000 + 5
    )
      return false;
    if (identity.subject === "")
      return identity["common_name"] === config.machine.clientId;
    return (
      typeof identity["email"] === "string" &&
      config.humans.includes(identity["email"])
    );
  } catch {
    return false;
  }
}
