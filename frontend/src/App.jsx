import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import axios from "axios";
import "./index.css";
import TopBar from "./components/TopBar";
import AuthModal from "./components/AuthModal";
import Sidebar from "./components/Sidebar";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const PLATFORMS = ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"];

const TONES = [
  "Professional", "Sarcastic", "Funny", "Controversial", "Curiosity",
  "Emotional", "Storytelling", "Bold", "Luxury", "Dark Humor",
  "Shocking", "Motivational", "Educational",
];

const LANGUAGES = [
  "English", "Tamil", "Hindi", "Telugu", "Malayalam",
  "Kannada", "Spanish", "French", "German", "Japanese",
];

const API_URL = `${BASE_URL}/generate`;
const LOGIN_URL = `${BASE_URL}/auth/login`;
const ME_URL = `${BASE_URL}/auth/me`;
const SIGNUP_URL = `${BASE_URL}/auth/signingup`;
const HISTORY_URL = `${BASE_URL}/history`;

const EMPTY_ERRORS = { description: "", platform: "", tone: "", language: "" };

const toHooksArray = (hooks) => {
  if (Array.isArray(hooks)) return hooks;
  if (typeof hooks === "string") {
    return hooks
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  return [];
};

const recencyOf = (item, index) => {
  const stamp = item.created_at ?? item.createdAt ?? item.timestamp;
  return stamp ? new Date(stamp).getTime() : index;
};

function App() {
 
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("");
  const [tone, setTone] = useState("");
  const [language, setLanguage] = useState("");
  const [errors, setErrors] = useState(EMPTY_ERRORS);

 
  const [resultsBatches, setResultsBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const nextBatchId = useRef(0);
  const resultsRef = useRef(null);


  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [hasFreshResults, setHasFreshResults] = useState(false);

  const previousHooksRef = useRef(null);


  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null); // null | "login" | "signup"
  const [sidebarOpen, setSidebarOpen] = useState(false);


  const [history, setHistory] = useState([]);


  const getHistory = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const response = await axios.get(HISTORY_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(response.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const getMe = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    const response = await axios.get(ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(response.data);
    await getHistory();
  }, [getHistory]);

  const signup = async ({ username, email, password }) => {
    await axios.post(SIGNUP_URL, { username, email, password });
    await login({ email, password });
  };

  const login = async ({ email, password }) => {
    const response = await axios.post(LOGIN_URL, { email, password });
    localStorage.setItem("access_token", response.data.access_token);
    await getMe();
  };

  
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      getMe().catch(() => localStorage.removeItem("access_token"));
    }
    
  }, []);

  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
    setHistory([]);
    setSidebarOpen(false);
  };

  const handleAuthSuccess = () => setAuthMode(null);

  const handleSignupSubmit = async (payload) => {
    await signup(payload);
    handleAuthSuccess();
  };

  const handleLoginSubmit = async (payload) => {
    await login(payload);
    handleAuthSuccess();
  };

 
  const validate = () => {
    const next = {
      description: description.trim() ? "" : "Description is required.",
      platform: platform ? "" : "Please select a platform.",
      tone: tone ? "" : "Please select a tone.",
      language: language.trim() ? "" : "Please select a language.",
    };
    setErrors(next);
    return Object.values(next).every((message) => !message);
  };

  const clearFieldError = (field) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));

  const handleFieldChange = (setter, field) => (event) => {
    setter(event.target.value);
    clearFieldError(field);
    if (hasFreshResults) {
      setHasFreshResults(false);
    }
  };

  const requestHooks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.post(API_URL, {
        description,
        platform,
        tone,
        language,
        previous_hooks: previousHooksRef.current,
      });

      const hooks = toHooksArray(response.data.hooks);
      previousHooksRef.current = hooks;

      const token = localStorage.getItem("access_token");
      if (token) {
        await axios.post(
          HISTORY_URL,
          { description, platform, tone, language, hooks },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        await getHistory();
      }

      setResultsBatches((prev) => [
        ...prev,
        { id: nextBatchId.current++, hooks },
      ]);
      setHasGeneratedOnce(true);
      setHasFreshResults(true);
  
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [description, platform, tone, language, getHistory]);

  const handleGenerate = () => {
    if (!validate()) return;
    requestHooks();
  };

 
  const handleSelectHistory = (description) => {
    const matches = history
      .map((row, index) => ({ ...row, _recency: recencyOf(row, index) }))
      .filter((row) => row.description === description)
      .sort((a, b) => a._recency - b._recency); // oldest -> newest

    if (matches.length === 0) return;

    const newest = matches[matches.length - 1];
    setDescription(newest.description ?? "");
    setPlatform(newest.platform ?? "");
    setTone(newest.tone ?? "");
    setLanguage(newest.language ?? "");
    setErrors(EMPTY_ERRORS);

    const batches = matches.map((row) => ({
      id: nextBatchId.current++,
      hooks: toHooksArray(row.hooks),
    }));

    previousHooksRef.current = batches[batches.length - 1].hooks;
    setResultsBatches(batches);
    setHasGeneratedOnce(true);
    setHasFreshResults(true);
    setSidebarOpen(false);
  };


  const dedupedHistory = useMemo(() => {
    const latestByDescription = new Map();
    history.forEach((item, index) => {
      const key = item.description;
      const recency = recencyOf(item, index);
      const existing = latestByDescription.get(key);
      if (!existing || recency >= existing._recency) {
        latestByDescription.set(key, { ...item, _recency: recency });
      }
    });

    return Array.from(latestByDescription.values()).sort(
      (a, b) => b._recency - a._recency
    );
  }, [history]);

  const isSplit = hasGeneratedOnce;
  const isSingleBatch = resultsBatches.length <= 1;

  let runningIndex = 0;
  const renderedBatches = resultsBatches.map((batch) => ({
    id: batch.id,
    items: batch.hooks.map((hook, i) => ({
      key: `${batch.id}-${i}`,
      label: String((runningIndex += 1)).padStart(2, "0"),
      text: hook,
      delay: i * 150,
    })),
  }));

  return (
    <div className="shell">
      <TopBar
        user={user}
        onOpenLogin={() => setAuthMode("login")}
        onOpenSignup={() => setAuthMode("signup")}
        onAvatarClick={() => setSidebarOpen((open) => !open)}
      />

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitchMode={(mode) => setAuthMode(mode)}
          onSubmitLogin={handleLoginSubmit}
          onSubmitSignup={handleSignupSubmit}
        />
      )}

      <Sidebar
        open={sidebarOpen}
        user={user}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
        history={dedupedHistory}
        onSelectHistory={handleSelectHistory}
      />

      <main className={`layout ${isSplit ? "layout--split" : "layout--centered"}`}>
        <section className={`panel panel--form ${isSplit ? "panel--form-compact" : ""}`}>
          <div className="brand">
            <span className="brand__mark">ScrollStop</span>
            <p className="brand__subtitle">Generate viral hooks with AI</p>
          </div>

          <div className="field">
            <textarea
              className={`input input--textarea ${isSplit ? "input--textarea-compact" : ""}`}
              placeholder="Describe your content..."
              value={description}
              onChange={handleFieldChange(setDescription, "description")}
            />
            {errors.description && <p className="field__error">{errors.description}</p>}
          </div>

          <div className="field-row">
            <div className="field">
              <select
                className="input"
                value={platform}
                onChange={handleFieldChange(setPlatform, "platform")}
              >
                <option value="" disabled hidden>Select platform</option>
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              {errors.platform && <p className="field__error">{errors.platform}</p>}
            </div>

            <div className="field">
              <select
                className="input"
                value={tone}
                onChange={handleFieldChange(setTone, "tone")}
              >
                <option value="" disabled hidden>Select tone</option>
                {TONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              {errors.tone && <p className="field__error">{errors.tone}</p>}
            </div>
          </div>

          <div className="field">
            <input
              type="text"
              list="languages"
              className="input"
              placeholder="Select language"
              value={language}
              onChange={handleFieldChange(setLanguage, "language")}
            />
            <datalist id="languages">
              {LANGUAGES.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            {errors.language && <p className="field__error">{errors.language}</p>}
          </div>

          <button className="btn" onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <span className="loading" aria-label="Generating">
                <span></span><span></span><span></span>
              </span>
            ) : hasFreshResults ? (
              "Generate again"
            ) : (
              "Generate hooks"
            )}
          </button>
        </section>

        {hasGeneratedOnce && (
          <section className="panel panel--results">
            <div
              className={`results ${isSingleBatch ? "results--single" : "results--multi"}`}
              ref={resultsRef}
            >
              {renderedBatches.map((batch) => (
                <div key={batch.id} className="results-batch">
                  {batch.items.map((item) => (
                    <p
                      key={item.key}
                      className="hook"
                      style={{ animationDelay: `${item.delay}ms` }}
                    >
                      <span className="hook__index">{item.label}</span>
                      <span className="hook__text">{item.text}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
