"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { Inbox, type Recipient } from "./inbox";
import { Reputation } from "./reviews";
import { JobCheckout, Payments } from "./payments";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Search,
  SlidersHorizontal,
  Plus,
  UserRound,
  LogOut,
  ArrowRight,
  Check,
  Layers,
  X,
  Pencil,
  Trash2,
  Mail,
  CreditCard,
} from "lucide-react";
type User = {
  id: string;
  name: string;
  email: string;
  role: "client" | "freelancer";
  bio: string;
  skills: string[];
  experience: string;
  portfolio: string;
  organization: string;
};
type SkillMatch = {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
};
type Job = {
  id: string;
  clientId: string;
  title: string;
  description: string;
  requiredSkills: string[];
  category: string;
  budget: number;
  status: string;
  clientName: string;
  organization: string;
  createdAt: string;
  match?: SkillMatch;
};
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const data = await r
      .json()
      .catch(() => ({ error: "Unable to connect. Please try again." }));
    throw new Error(data.error || "Request failed");
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
const categories = ["Development", "Design", "Writing", "Marketing", "Other"];
const split = (text: string) => [
  ...new Set(
    text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];
export default function Home() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [jobs, setJobs] = useState<Job[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [view, setView] = useState<
      "browse" | "mine" | "profile" | "inbox" | "payments"
    >("browse"),
    [recipient, setRecipient] = useState<Recipient | null>(null),
    [paymentReturn, setPaymentReturn] = useState<string | null>(null),
    [modal, setModal] = useState<"login" | "register" | "job" | null>(null),
    [editing, setEditing] = useState<Job | null>(null),
    [selected, setSelected] = useState<Job | null>(null),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [jobSort, setJobSort] = useState("newest"),
    [skill, setSkill] = useState(""),
    [category, setCategory] = useState(""),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const matchUserId =
    view === "browse" && user?.role === "freelancer" && jobSort === "match"
      ? user.id
      : undefined;
  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const signedInId = user?.id;
  useEffect(() => {
    if (!signedInId) return;
    const url = new URL(window.location.href);
    const returned = url.searchParams.get("payments");
    if (!returned) return;
    setPaymentReturn(returned);
    setView("payments");
    url.searchParams.delete("payments");
    window.history.replaceState(window.history.state, "", url);
  }, [signedInId]);
  useEffect(() => {
    if (view === "profile" || view === "inbox" || view === "payments") return;
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (view === "mine") params.set("mine", "true");
    if (matchUserId) params.set("sort", "match");
    if (search) params.set("search", search);
    if (skill) params.set("skill", skill);
    if (category) params.set("category", category);
    if (min) params.set("minBudget", min);
    if (max) params.set("maxBudget", max);
    const timer = setTimeout(() => {
      api<{ jobs: Job[]; total: number }>("/jobs?" + params)
        .then((d) => {
          if (active) {
            setJobs(d.jobs);
            setTotal(d.total);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [view, search, skill, category, min, max, page, revision, matchUserId]);
  const dialogRef = useRef<HTMLElement>(null);
  const dialogOpen = !!modal || !!selected;
  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input,select,textarea,a[href]",
        ) || [],
      );
    focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setModal(null);
        setSelected(null);
        setError("");
      }
      if (event.key === "Tab") {
        const items = focusables(),
          first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [dialogOpen, busy]);
  const changeView = (v: typeof view) => {
    setPaymentReturn(null);
    setRecipient(null);
    setView(v);
    setPage(1);
    setError("");
    setNotice("");
  };
  const close = () => {
    setModal(null);
    setSelected(null);
    setError("");
  };
  const refresh = () => setRevision((v) => v + 1);
  function messageRecipient(recipient: Recipient) {
    close();
    changeView("inbox");
    setRecipient(recipient);
  }
  async function logout() {
    try {
      await api("/auth/logout", "POST");
      setUser(null);
      changeView("browse");
      setNotice("You have been signed out.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submitAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      email: f.get("email"),
      password: f.get("password"),
    };
    if (modal === "register") {
      body.name = f.get("name");
      body.role = f.get("role");
    }
    try {
      setUser(await api<User>("/auth/" + modal, "POST", body));
      setModal(null);
      setNotice("You’re signed in. Welcome to your next chapter.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      setUser(
        await api<User>("/users/" + user.id, "PUT", {
          name: f.get("name"),
          bio: f.get("bio"),
          skills:
            user.role === "freelancer"
              ? split(String(f.get("skills")))
              : user.skills,
          experience:
            user.role === "freelancer" ? f.get("experience") : user.experience,
          portfolio:
            user.role === "freelancer" ? f.get("portfolio") : user.portfolio,
          organization:
            user.role === "client" ? f.get("organization") : user.organization,
        }),
      );
      setNotice("Profile saved successfully.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api(
        "/jobs" + (editing ? "/" + editing.id : ""),
        editing ? "PUT" : "POST",
        {
          title: f.get("title"),
          description: f.get("description"),
          requiredSkills: split(String(f.get("requiredSkills"))),
          category: f.get("category"),
          budget: Number(f.get("budget")),
          status: f.get("status"),
        },
      );
      setModal(null);
      setNotice(editing ? "Job updated." : "Your job is live.");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeJob(j: Job) {
    if (!window.confirm("Delete “" + j.title + "”? This cannot be undone."))
      return;
    setBusy(true);
    try {
      await api("/jobs/" + j.id, "DELETE");
      setSelected(null);
      setNotice("Job deleted.");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Stability Network home">
          <span className="brand-icon">
            <Layers size={24} />
          </span>
          <span>
            stability<span className="brand-sub">FREELANCER NETWORK</span>
          </span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          <button
            className={view === "browse" ? "active" : ""}
            onClick={() => changeView("browse")}
          >
            <BriefcaseBusiness size={19} />
            Discover jobs
            <ArrowUpRight size={16} />
          </button>
          {user?.role === "client" && (
            <button
              className={view === "mine" ? "active" : ""}
              onClick={() => changeView("mine")}
            >
              <Layers size={19} />
              My job postings
            </button>
          )}
          {user && (
            <button
              className={view === "profile" ? "active" : ""}
              onClick={() => changeView("profile")}
            >
              <UserRound size={19} />
              My profile
            </button>
          )}
          {user && (
            <button
              className={view === "inbox" ? "active" : ""}
              onClick={() => changeView("inbox")}
            >
              <Mail size={19} />
              Inbox
            </button>
          )}
          {user && (
            <button
              className={view === "payments" ? "active" : ""}
              onClick={() => changeView("payments")}
            >
              <CreditCard size={19} />
              Payments
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="community">
            <span className="little-star">✳</span>
            <h3>
              Good work.
              <br />
              Greater stability.
            </h3>
            <p>A network built around people and possibilities.</p>
          </div>
          {user ? (
            <div className="account">
              <span className="avatar">{user.name.slice(0, 1)}</span>
              <span>
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </span>
              <button aria-label="Log out" title="Log out" onClick={logout}>
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <button
              className="sidebar-login"
              onClick={() => {
                setError("");
                setModal("login");
              }}
            >
              Sign in to your workspace <ArrowRight size={16} />
            </button>
          )}
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            {view === "profile"
              ? "My profile"
              : view === "mine"
                ? "My job postings"
                : view === "inbox"
                  ? "Inbox"
                  : view === "payments"
                    ? "Payments"
                    : "Discover jobs"}
          </div>
          <div className="header-actions">
            <span className="live-dot" />
            Marketplace foundation
            {user && (
              <button
                className="mobile-signout"
                aria-label="Log out on mobile"
                onClick={logout}
              >
                <LogOut size={17} />
              </button>
            )}
            {ready && !user && (
              <>
                <button
                  className="text-button"
                  onClick={() => {
                    setError("");
                    setModal("login");
                  }}
                >
                  Log in
                </button>
                <button
                  className="dark-button"
                  onClick={() => {
                    setError("");
                    setModal("register");
                  }}
                >
                  Join the network <ArrowUpRight size={15} />
                </button>
              </>
            )}
          </div>
        </header>
        <div className="content">
          {notice && (
            <div className="notice" role="status">
              <Check size={17} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && !modal && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {view === "payments" && user ? (
            <Payments
              key={user.id}
              api={api}
              freelancer={user.role === "freelancer"}
              returned={paymentReturn}
            />
          ) : view === "inbox" && user ? (
            <Inbox
              key={user.id + (recipient?.id ?? "")}
              api={api}
              userId={user.id}
              recipient={recipient}
            />
          ) : view === "profile" && user ? (
            <>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
                  <h1>Make yourself known.</h1>
                  <p>
                    Share your story, strengths, and what you bring to the
                    table.
                  </p>
                </div>
              </div>
              <form
                className="profile-form panel"
                onSubmit={saveProfile}
                key={user.id}
              >
                <h2>Your {user.role} profile</h2>
                <Reputation api={api} userId={user.id} />
                <label>
                  Full name
                  <input
                    name="name"
                    defaultValue={user.name}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                <label>
                  {user.role === "client"
                    ? "About you / organization"
                    : "Biography"}
                  <textarea
                    name="bio"
                    defaultValue={user.bio}
                    maxLength={3000}
                    rows={4}
                  />
                </label>
                {user.role === "freelancer" ? (
                  <>
                    <label>
                      Skills <small>Separate with commas</small>
                      <input
                        name="skills"
                        defaultValue={user.skills.join(", ")}
                        placeholder="React, Node.js, MongoDB"
                      />
                    </label>
                    <label>
                      Experience
                      <textarea
                        name="experience"
                        defaultValue={user.experience}
                        maxLength={3000}
                        rows={4}
                      />
                    </label>
                    <label>
                      Portfolio URL
                      <input
                        name="portfolio"
                        type="url"
                        defaultValue={user.portfolio}
                        placeholder="https://your-portfolio.com"
                        maxLength={500}
                      />
                    </label>
                  </>
                ) : (
                  <label>
                    Organization
                    <input
                      name="organization"
                      defaultValue={user.organization}
                      maxLength={150}
                    />
                  </label>
                )}
                <button className="dark-button" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                  <Check size={16} />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    INDEPENDENT WORK. SHARED OPPORTUNITY.
                  </div>
                  <h1>
                    {view === "mine"
                      ? "Build something together."
                      : "Your skills. New possibilities."}
                  </h1>
                  <p>
                    {view === "mine"
                      ? "Find the right people for the work that matters."
                      : "Discover meaningful projects and take your next step forward."}
                  </p>
                </div>
                {user?.role === "client" && (
                  <button
                    className="dark-button"
                    onClick={() => {
                      setEditing(null);
                      setError("");
                      setModal("job");
                    }}
                  >
                    <Plus size={17} />
                    Post a job
                  </button>
                )}
              </div>
              {view === "browse" && (
                <section className="hero">
                  <div className="hero-copy">
                    <span className="hero-label">
                      <span />A MORE HUMAN WAY TO WORK
                    </span>
                    <h2>
                      Find work that moves
                      <br />
                      you forward.
                    </h2>
                    <p>
                      Connect directly. Put your expertise to work.
                      <br />
                      Build a future on your own terms.
                    </p>
                    <button
                      onClick={() => document.getElementById("search")?.focus()}
                    >
                      Explore opportunities <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <div className="art-tile tile-one">
                      <Layers size={37} />
                    </div>
                    <div className="art-tile tile-two">
                      <ArrowUpRight size={70} />
                    </div>
                    <span className="art-plus">+</span>
                    <span className="art-dot" />
                  </div>
                  <div className="hero-foot">
                    Built for independent talent. Designed for lasting
                    connections.
                  </div>
                </section>
              )}
              <div className="list-heading">
                <h2>
                  {view === "mine"
                    ? "Your job postings"
                    : "Explore opportunities"}{" "}
                  <span>{total}</span>
                </h2>
                {view === "browse" && user?.role === "freelancer" ? (
                  <select
                    className="job-sort"
                    aria-label="Sort jobs"
                    value={jobSort}
                    onChange={(event) => {
                      setJobSort(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="newest">Newest first</option>
                    <option value="match">Best skill match</option>
                  </select>
                ) : (
                  <span className="sort-label">Newest first ↓</span>
                )}
              </div>
              {matchUserId && user?.skills.length === 0 && (
                <p>
                  Add skills in{" "}
                  <button
                    className="text-button"
                    onClick={() => changeView("profile")}
                  >
                    My profile
                  </button>{" "}
                  to see how well jobs match.
                </p>
              )}
              <div className="filters">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    id="search"
                    aria-label="Search jobs"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by title or keyword…"
                  />
                </div>
                <select
                  aria-label="Filter by category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <div className="skill-field">
                  <SlidersHorizontal size={16} />
                  <input
                    aria-label="Filter by skill"
                    value={skill}
                    onChange={(e) => {
                      setSkill(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Skill, e.g. React"
                  />
                </div>
              </div>
              <div className="budget-row">
                <span>Budget (USD)</span>
                <input
                  type="number"
                  min="0"
                  aria-label="Minimum budget"
                  placeholder="Min"
                  value={min}
                  onChange={(e) => {
                    setMin(e.target.value);
                    setPage(1);
                  }}
                />
                <span>—</span>
                <input
                  type="number"
                  min="0"
                  aria-label="Maximum budget"
                  placeholder="Max"
                  value={max}
                  onChange={(e) => {
                    setMax(e.target.value);
                    setPage(1);
                  }}
                />
                {(search || skill || category || min || max) && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearch("");
                      setSkill("");
                      setCategory("");
                      setMin("");
                      setMax("");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {loading ? (
                <div className="empty" role="status">
                  Finding opportunities…
                </div>
              ) : jobs.length === 0 ? (
                <div className="empty">
                  <span className="empty-icon">
                    <BriefcaseBusiness size={28} />
                  </span>
                  <h3>
                    {search || skill || category || min || max
                      ? "No jobs match these filters."
                      : "The next opportunity starts here."}
                  </h3>
                  <p>
                    {search || skill || category || min || max
                      ? "Try a different keyword or a wider budget range."
                      : user?.role === "client"
                        ? "Post your first project and connect with independent talent."
                        : "New opportunities will appear here as clients post projects."}
                  </p>
                  {!user && (
                    <button
                      className="dark-button"
                      onClick={() => {
                        setError("");
                        setModal("register");
                      }}
                    >
                      Create your account <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="job-grid">
                  {jobs.map((j) => (
                    <article className="job-card" key={j.id}>
                      <div className="job-top">
                        <span
                          className={"company-icon " + j.category.toLowerCase()}
                        >
                          {(j.organization || j.clientName)
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                        <div>
                          <strong>{j.organization || j.clientName}</strong>
                          <small>
                            {new Date(j.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            · {j.category}
                          </small>
                        </div>
                        <span className="job-status">
                          {j.status.replace("_", " ")}
                        </span>
                      </div>
                      <button
                        className="job-title"
                        onClick={() => {
                          setSelected(j);
                          setError("");
                        }}
                      >
                        {j.title}
                        <ArrowUpRight size={19} />
                      </button>
                      <p className="job-description">{j.description}</p>
                      {matchUserId && j.match && (
                        <div className="skill-match">
                          <strong>{j.match.score}% skill match</strong>
                        </div>
                      )}
                      <div className="tags">
                        {j.requiredSkills.slice(0, 5).map((s) => (
                          <span key={s}>{s}</span>
                        ))}
                      </div>
                      <div className="job-bottom">
                        <div>
                          <strong>{money(j.budget)}</strong>
                          <span>Fixed project budget</span>
                        </div>
                        {view === "mine" ? (
                          <div className="card-actions">
                            <button
                              aria-label={"Edit " + j.title}
                              onClick={() => {
                                setEditing(j);
                                setError("");
                                setModal("job");
                              }}
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              aria-label={"Delete " + j.title}
                              disabled={busy}
                              onClick={() => removeJob(j)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="view-job"
                            onClick={() => setSelected(j)}
                          >
                            View project <ArrowRight size={16} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {total > 20 && (
                <div className="pagination">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {Math.ceil(total / 20)}
                  </span>
                  <button
                    disabled={page * 20 >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
          <footer>
            <span>
              © {new Date().getFullYear()} Freelancer Stability Network
            </span>
            <span>
              More possibility. Together. <span className="footer-star">✳</span>
            </span>
          </footer>
        </div>
      </main>
      {(modal || selected) && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) close();
          }}
        >
          <section
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <button
              className="close"
              aria-label="Close dialog"
              disabled={busy}
              onClick={close}
            >
              <X size={21} />
            </button>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {modal === "login" || modal === "register" ? (
              <>
                <div className="eyebrow">WELCOME TO THE NETWORK</div>
                <h2 id="dialog-title">
                  {modal === "login"
                    ? "Your next chapter awaits."
                    : "Let’s build your next chapter."}
                </h2>
                <p className="muted">Good work begins with a connection.</p>
                <form onSubmit={submitAuth}>
                  {modal === "register" && (
                    <>
                      <label>
                        Full name
                        <input
                          name="name"
                          required
                          minLength={2}
                          maxLength={100}
                          autoComplete="name"
                        />
                      </label>
                      <label>
                        I’m joining as a
                        <select name="role">
                          <option value="freelancer">
                            Freelancer — find work
                          </option>
                          <option value="client">Client — hire talent</option>
                        </select>
                      </label>
                    </>
                  )}
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      maxLength={254}
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={10}
                      maxLength={128}
                      autoComplete={
                        modal === "login" ? "current-password" : "new-password"
                      }
                    />
                    <small>At least 10 characters</small>
                  </label>
                  <button className="dark-button full" disabled={busy}>
                    {busy
                      ? "Please wait…"
                      : modal === "login"
                        ? "Log in"
                        : "Create account"}
                    <ArrowRight size={17} />
                  </button>
                </form>
                <button
                  className="switch-auth"
                  disabled={busy}
                  onClick={() => {
                    setModal(modal === "login" ? "register" : "login");
                    setError("");
                  }}
                >
                  {modal === "login"
                    ? "New here? Create an account"
                    : "Already a member? Log in"}
                </button>
              </>
            ) : modal === "job" ? (
              <>
                <div className="eyebrow">TURN AN IDEA INTO OPPORTUNITY</div>
                <h2 id="dialog-title">
                  {editing ? "Edit your project" : "Post a new project"}
                </h2>
                <form onSubmit={saveJob} key={editing?.id || "new"}>
                  <label>
                    Project title
                    <input
                      name="title"
                      required
                      minLength={5}
                      maxLength={150}
                      defaultValue={editing?.title}
                      placeholder="e.g. Build a responsive React website"
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      name="description"
                      required
                      minLength={20}
                      maxLength={10000}
                      rows={5}
                      defaultValue={editing?.description}
                      placeholder="Describe the work, deliverables, and what success looks like."
                    />
                  </label>
                  <label>
                    Required skills <small>Separate with commas</small>
                    <input
                      name="requiredSkills"
                      required
                      defaultValue={editing?.requiredSkills.join(", ")}
                      placeholder="React, TypeScript, Node.js"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Category
                      <select
                        name="category"
                        defaultValue={editing?.category || "Development"}
                      >
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Budget (USD)
                      <input
                        name="budget"
                        type="number"
                        required
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        defaultValue={editing?.budget}
                      />
                    </label>
                  </div>
                  <label>
                    Status
                    <select
                      name="status"
                      defaultValue={editing?.status || "open"}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <button className="dark-button full" disabled={busy}>
                    {busy
                      ? "Saving…"
                      : editing
                        ? "Save changes"
                        : "Publish project"}
                    <ArrowUpRight size={17} />
                  </button>
                </form>
              </>
            ) : selected ? (
              <>
                <div className="eyebrow">
                  {selected.category} · {selected.status.replace("_", " ")}
                </div>
                <h2 id="dialog-title">{selected.title}</h2>
                <p className="muted">
                  Posted by {selected.organization || selected.clientName}
                </p>
                <div className="detail-budget">
                  {money(selected.budget)} <small>Fixed project budget</small>
                </div>
                {user && <Reputation api={api} userId={selected.clientId} />}
                <h3>About the project</h3>
                <p className="detail-description">{selected.description}</p>
                <h3>Skills needed</h3>
                <div className="tags">
                  {selected.requiredSkills.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
                {user?.role === "freelancer" && (
                  <button
                    className="dark-button message-action"
                    onClick={() =>
                      messageRecipient({
                        id: selected.clientId,
                        name: selected.clientName,
                      })
                    }
                  >
                    Message client <Mail size={16} />
                  </button>
                )}
                {user &&
                  (user.role === "freelancer" ||
                    user.id === selected.clientId) && (
                    <JobMatches
                      key={selected.id + user.id}
                      jobId={selected.id}
                      role={user.role}
                      onMessage={messageRecipient}
                    />
                  )}
                {user?.id === selected.clientId && (
                  <JobCheckout
                    key={selected.id}
                    api={api}
                    jobId={selected.id}
                    budget={selected.budget}
                  />
                )}
                {user?.id === selected.clientId && (
                  <button
                    className="dark-button"
                    onClick={() => {
                      setEditing(selected);
                      setSelected(null);
                      setModal("job");
                    }}
                  >
                    Edit project <Pencil size={16} />
                  </button>
                )}
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
type CandidateMatch = SkillMatch & { id: string; name: string };
function JobMatches({
  jobId,
  role,
  onMessage,
}: {
  jobId: string;
  role: User["role"];
  onMessage: (recipient: Recipient) => void;
}) {
  const [result, setResult] = useState<{
    match?: SkillMatch;
    matches?: CandidateMatch[];
    total?: number;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<NonNullable<typeof result>>(`/jobs/${jobId}/matches`)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [jobId]);
  if (error) return <p role="alert">{error}</p>;
  if (!result) return <p role="status">Checking skill matches…</p>;
  if (result.match) {
    return (
      <div className="skill-match">
        <strong>{result.match.score}% skill match</strong>
        <p>
          Matched skills: {result.match.matchedSkills.join(", ") || "None yet"}
        </p>
        <p>Skills to add: {result.match.missingSkills.join(", ") || "None"}</p>
      </div>
    );
  }
  if (role !== "client") return null;
  const matches = result.matches ?? [];
  return (
    <div className="skill-match">
      <h3>Matching freelancers</h3>
      {!matches.length ? (
        <p>No freelancers have matching skills yet.</p>
      ) : (
        <>
          {(result.total ?? 0) > matches.length && (
            <p>
              Showing the top {matches.length} of {result.total} matches.
            </p>
          )}
          <ul>
            {matches.map((match) => (
              <li key={match.id}>
                <strong>
                  {match.name} · {match.score}%
                </strong>{" "}
                · {match.matchedSkills.join(", ")}
                <button
                  className="text-button"
                  onClick={() => onMessage({ id: match.id, name: match.name })}
                >
                  Message {match.name}
                </button>
                <details>
                  <summary>View reviews for {match.name}</summary>
                  <Reputation api={api} userId={match.id} />
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
function money(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);
}
