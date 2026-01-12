import React, { useCallback, useEffect, useMemo, useState } from "react";

const statusLabel = (key) => {
  if (key.revokedAt) return "Revoked";
  if (key.expiresAt) {
    const expiry = new Date(key.expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry < new Date()) {
      return "Expired";
    }
  }
  return "Active";
};

const statusStyles = {
  Active: "bg-emerald-100 text-emerald-700",
  Revoked: "bg-slate-100 text-slate-600",
  Expired: "bg-amber-100 text-amber-700",
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const ApiKeysPanel = ({
  apiFetch,
  teamId,
  title = "API keys",
  description = "Create keys for CI uploads. Keys are shown only once.",
}) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyToken, setApiKeyToken] = useState(null);
  const [apiKeyError, setApiKeyError] = useState("");
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const headers = useMemo(() => ({ "x-team-id": teamId }), [teamId]);

  useEffect(() => {
    if (!apiFetch || !teamId) {
      setApiKeys([]);
      return;
    }
    let isMounted = true;
    setIsLoadingKeys(true);
    apiFetch("/api-keys", { headers })
      .then((payload) => {
        if (isMounted) {
          setApiKeys(Array.isArray(payload?.apiKeys) ? payload.apiKeys : []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setApiKeys([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingKeys(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [apiFetch, headers, teamId]);

  const handleCreateApiKey = useCallback(async () => {
    if (!apiFetch || !teamId) return;
    const trimmed = apiKeyName.trim();
    if (!trimmed) {
      setApiKeyError("Key name is required.");
      return;
    }
    setApiKeyError("");
    setIsCreatingKey(true);
    try {
      const payload = await apiFetch("/api-keys", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: trimmed }),
      });
      setApiKeys((current) => [payload.apiKey, ...current]);
      setApiKeyToken(payload.token);
      setApiKeyName("");
    } catch {
      setApiKeyError("Unable to create API key.");
    } finally {
      setIsCreatingKey(false);
    }
  }, [apiFetch, apiKeyName, headers, teamId]);

  const handleCopyKey = useCallback(() => {
    if (!apiKeyToken) return;
    navigator.clipboard?.writeText(apiKeyToken).catch(() => undefined);
  }, [apiKeyToken]);

  const handleConfirmRevoke = useCallback(async () => {
    if (!pendingRevoke || !apiFetch || !teamId) return;
    setIsRevoking(true);
    try {
      await apiFetch(`/api-keys/${pendingRevoke.id}`, {
        method: "DELETE",
        headers,
      });
      const revokedAt = new Date().toISOString();
      setApiKeys((current) =>
        current.map((key) =>
          key.id === pendingRevoke.id ? { ...key, revokedAt } : key,
        ),
      );
    } finally {
      setIsRevoking(false);
      setPendingRevoke(null);
    }
  }, [apiFetch, headers, pendingRevoke, teamId]);

  if (!teamId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Create a team to manage API keys.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Key name
        </label>
        <input
          value={apiKeyName}
          onChange={(event) => setApiKeyName(event.target.value)}
          className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
          placeholder="CI uploads"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            onClick={handleCreateApiKey}
            disabled={isCreatingKey || !apiKeyName.trim()}
          >
            {isCreatingKey ? "Creating..." : "Create key"}
          </button>
          <p className="text-xs text-slate-500">Store the key securely.</p>
        </div>
        {apiKeyError ? <p className="mt-2 text-xs text-red-500">{apiKeyError}</p> : null}
      </div>
      {isLoadingKeys ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Loading API keys...
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No API keys yet. Create one for CI uploads.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Name</span>
            <span>Key</span>
            <span>Created</span>
            <span>Last used</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          <div>
            {apiKeys.map((key) => {
              const status = statusLabel(key);
              return (
                <div
                  key={key.id}
                  className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 border-b border-slate-200 py-4 text-sm last:border-b-0"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{key.name}</div>
                    <div className="text-xs text-slate-400">ID: {key.id}</div>
                  </div>
                  <div className="text-slate-500">{key.prefix}...</div>
                  <div className="text-slate-500">{formatDateTime(key.createdAt)}</div>
                  <div className="text-slate-500">{formatDateTime(key.lastUsedAt)}</div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        statusStyles[status]
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    {key.revokedAt ? (
                      <span className="text-xs text-slate-400">Revoked</span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600"
                        onClick={() => setPendingRevoke(key)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {apiKeyToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Copy your new API key</h3>
            <p className="mt-2 text-sm text-slate-500">
              This key will only be shown once. Store it securely.
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <span className="break-all font-mono">{apiKeyToken}</span>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600"
                onClick={handleCopyKey}
              >
                Copy
              </button>
              <button
                type="button"
                className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white"
                onClick={() => setApiKeyToken(null)}
              >
                I saved it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingRevoke ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Revoke API key?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Revoke \"{pendingRevoke.name}\"? CI uploads using this key will stop working.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600"
                onClick={() => setPendingRevoke(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
              >
                {isRevoking ? "Revoking..." : "Revoke key"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ApiKeysPanel;
