import { useCallback, useEffect, useMemo, useState } from "react";

type SettingsTab = "rootDirectories" | "ignorePaths" | "ignoreExtensions";

type SearchSettings = {
  rootDirectories: string[];
  ignorePaths: string[];
  ignoreExtensions: string[];
};

const DEFAULT_SETTINGS: SearchSettings = {
  rootDirectories: [],
  ignorePaths: [],
  ignoreExtensions: [],
};

const TAB_CONFIG: Array<{ id: SettingsTab; label: string; helper: string }> = [
  {
    id: "rootDirectories",
    label: "Root directories",
    helper: "Folders where search starts.",
  },
  {
    id: "ignorePaths",
    label: "Ignore paths",
    helper: "Exact paths or prefixes to exclude.",
  },
  {
    id: "ignoreExtensions",
    label: "Ignore extensions",
    helper: "File extensions to skip (example: .log).",
  },
];

type TabEndpoints = {
  postPath: string;
  getPath: string;
  paramName: "directory" | "extension";
};

const TAB_ENDPOINTS: Record<SettingsTab, TabEndpoints> = {
  rootDirectories: {
    postPath: "/post_root_directory_rules",
    getPath: "/get_root_directory_rules",
    paramName: "directory",
  },
  ignorePaths: {
    postPath: "/post_ignore_directory_rules",
    getPath: "/get_ignore_directory_rules",
    paramName: "directory",
  },
  ignoreExtensions: {
    postPath: "/post_ignore_extension_rules",
    getPath: "/get_ignore_extension_rules",
    paramName: "extension",
  },
};

const API_BASE_URL = "http://localhost:8080";

function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("rootDirectories");
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SETTINGS);
  const [draftValue, setDraftValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const activeConfig = useMemo(
    () => TAB_CONFIG.find((tab) => tab.id === activeTab),
    [activeTab],
  );

  const fetchRulesForTab = useCallback(async (tab: SettingsTab): Promise<string[]> => {
    const endpoint = TAB_ENDPOINTS[tab].getPath;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: "POST" });
    if (!response.ok) {
      throw new Error(`Failed to fetch settings from ${endpoint} (${response.status}).`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return [];
    return payload.filter((item): item is string => typeof item === "string");
  }, []);

  const refreshAllTabs = useCallback(async () => {
    const [rootDirectories, ignorePaths, ignoreExtensions] = await Promise.all([
      fetchRulesForTab("rootDirectories"),
      fetchRulesForTab("ignorePaths"),
      fetchRulesForTab("ignoreExtensions"),
    ]);

    setSettings({ rootDirectories, ignorePaths, ignoreExtensions });
  }, [fetchRulesForTab]);

  /** Load when the panel opens — avoids one-shot ref + Strict Mode races, and retries every time you reopen. */
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage("");

    void refreshAllTabs()
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setErrorMessage("Could not load settings from backend.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshAllTabs]);

  const executeRuleChange = async (tab: SettingsTab, type: 0 | 1 | 2, value: string) => {
    const { postPath, paramName } = TAB_ENDPOINTS[tab];
    const params = new URLSearchParams({
      type: String(type),
      [paramName]: value,
    });

    const response = await fetch(`${API_BASE_URL}${postPath}?${params.toString()}`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Failed to update settings on ${postPath} (${response.status}).`);
    }
  };

  const addItem = async () => {
    const value = draftValue.trim();
    if (!value) return;

    setErrorMessage("");
    setIsLoading(true);
    try {
      await executeRuleChange(activeTab, 1, value);
      const refreshed = await fetchRulesForTab(activeTab);
      setSettings((current) => ({ ...current, [activeTab]: refreshed }));
      setDraftValue("");
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not add value. Check backend connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (value: string) => {
    setErrorMessage("");
    setIsLoading(true);
    try {
      await executeRuleChange(activeTab, 2, value);
      const refreshed = await fetchRulesForTab(activeTab);
      setSettings((current) => ({ ...current, [activeTab]: refreshed }));
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not delete value. Check backend connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetActiveTab = async () => {
    setErrorMessage("");
    setIsLoading(true);
    let resetFailed = false;

    try {
      await executeRuleChange(activeTab, 0, "");
    } catch (error) {
      resetFailed = true;
      console.error(error);
      setErrorMessage("Could not reset values. Check backend connection.");
    }

    try {
      const refreshed = await fetchRulesForTab(activeTab);
      setSettings((current) => ({ ...current, [activeTab]: refreshed }));
      setDraftValue("");
      if (resetFailed) {
        setErrorMessage("Reset failed, but latest values were reloaded from backend.");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not reload values after reset.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
      >
        Settings
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="flex h-[34rem] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
            <aside className="w-64 border-r border-slate-800 bg-slate-950/60 p-3">
              <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Settings
              </p>
              <nav className="space-y-1">
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setDraftValue("");
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      activeTab === tab.id
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </aside>

            <section className="flex-1 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    {activeConfig?.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {activeConfig?.helper}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="mb-4 flex items-center gap-3">
                <input
                  type="text"
                  value={draftValue}
                  onChange={(event) => setDraftValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void addItem();
                    }
                  }}
                  placeholder={`Add ${activeConfig?.label?.toLowerCase()} value...`}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
                />
                <button
                  type="button"
                  onClick={() => void addItem()}
                  disabled={isLoading}
                  className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => void resetActiveTab()}
                  disabled={isLoading}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                >
                  Reset
                </button>
              </div>

              {errorMessage ? (
                <p className="mb-3 text-sm text-red-300">{errorMessage}</p>
              ) : null}

              <ul className="app-scrollbar h-[22rem] space-y-2 overflow-y-auto pr-2">
                {settings[activeTab].length === 0 ? (
                  <li className="rounded-md border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-400">
                    {isLoading ? "Loading..." : "No values configured."}
                  </li>
                ) : (
                  settings[activeTab].map((value, index) => (
                    <li
                      key={`${value}-${index}`}
                      className="flex items-center justify-between gap-4 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2"
                    >
                      <span className="break-all text-sm text-slate-200">{value}</span>
                      <button
                        type="button"
                        onClick={() => void removeItem(value)}
                        disabled={isLoading}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                      >
                        Delete
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default SettingsPanel;
