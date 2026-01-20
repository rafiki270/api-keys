import crypto from "node:crypto";

const DEFAULT_PREFIX = "ak_";
const DEFAULT_BYTES = 32;
const DEFAULT_PREFIX_LENGTH = 12;

export const resolveApiKeySecret = ({
  secret,
  env = process.env,
  envKey = "API_KEY_SECRET",
  fallbackEnvKeys = ["AUTH_JWT_SECRET"],
  defaultSecret,
} = {}) => {
  if (secret) return secret;
  if (env && env[envKey]) return env[envKey];
  if (env && Array.isArray(fallbackEnvKeys)) {
    for (const key of fallbackEnvKeys) {
      if (env[key]) return env[key];
    }
  }
  return defaultSecret;
};

const resolveSecretOrThrow = (options) => {
  const secret = resolveApiKeySecret(options);
  if (!secret) {
    throw new Error("API key secret is required");
  }
  return secret;
};

export const hashApiKey = (token, options = {}) => {
  const secret = typeof options === "string" ? options : resolveSecretOrThrow(options);
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
};

export const generateApiKey = (options = {}) => {
  const {
    prefix = DEFAULT_PREFIX,
    bytes = DEFAULT_BYTES,
    prefixLength = DEFAULT_PREFIX_LENGTH,
  } = options;
  const raw = crypto.randomBytes(bytes).toString("base64url");
  const token = `${prefix}${raw}`;
  return {
    token,
    tokenHash: hashApiKey(token, options),
    tokenPrefix: token.slice(0, prefixLength),
  };
};

export const buildApiKeyResponse = (record) => ({
  id: record.id,
  name: record.name,
  type: record.type,
  prefix: record.tokenPrefix,
  createdAt: record.createdAt,
  lastUsedAt: record.lastUsedAt,
  revokedAt: record.revokedAt,
  expiresAt: record.expiresAt,
  createdBy: record.createdByUser
    ? {
        id: record.createdByUser.id,
        name: record.createdByUser.fullName,
        email: record.createdByUser.email,
        username: record.createdByUser.username,
      }
    : null,
});

export const listApiKeys = async (prisma, teamId) => {
  return prisma.apiKey.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    include: {
      createdByUser: {
        select: { id: true, fullName: true, email: true, username: true },
      },
    },
  });
};

export const createApiKey = async (prisma, input) => {
  const { teamId, name, type = "upload", createdByUserId, expiresAt, ...options } = input;
  const now = new Date();
  const { token, tokenHash, tokenPrefix } = generateApiKey(options);
  const apiKey = await prisma.apiKey.create({
    data: {
      teamId,
      name,
      type,
      tokenHash,
      tokenPrefix,
      createdByUserId: createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresAt ?? null,
    },
    include: {
      createdByUser: {
        select: { id: true, fullName: true, email: true, username: true },
      },
    },
  });
  return { apiKey, token };
};

export const revokeApiKey = async (prisma, input) => {
  const { id, teamId } = input;
  const existing = await prisma.apiKey.findFirst({
    where: { id, teamId },
  });
  if (!existing) {
    return { revoked: false, notFound: true };
  }
  if (existing.revokedAt) {
    return { revoked: true, record: existing };
  }
  const record = await prisma.apiKey.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
  return { revoked: true, record };
};

export const verifyApiKey = async (prisma, token, options = {}) => {
  if (!token || !token.trim()) {
    return { apiKey: null, error: "api_key_missing" };
  }
  const tokenHash = hashApiKey(token.trim(), options);
  const apiKey = await prisma.apiKey.findUnique({
    where: { tokenHash },
    include: { team: true },
  });
  if (!apiKey || apiKey.revokedAt) {
    return { apiKey: null, error: "api_key_invalid" };
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { apiKey: null, error: "api_key_expired" };
  }
  if (options.touch !== false) {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
  }
  return { apiKey, error: null };
};

export const validateApiKey = async (prisma, token, options = {}) => {
  const { teamId, touch = true, ...rest } = options;
  const result = await verifyApiKey(prisma, token, { ...rest, touch });
  if (result.error) {
    return result;
  }
  if (teamId && result.apiKey?.teamId !== teamId) {
    return { apiKey: null, error: "api_key_forbidden" };
  }
  return { apiKey: result.apiKey, error: null };
};
