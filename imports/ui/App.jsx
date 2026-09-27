import { useEffect, useRef, useState } from "react";
import { Accounts } from "meteor/accounts-base";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { MenuItems } from "/imports/api/menuItems";
import { retranslateMessage, translate, translateError } from "/imports/ui/i18n";

const chalkColors = ["sunset", "sky", "mint", "lemon", "coral", "lavender"];
const emptyForm = {
  name: "",
  description: "",
  descriptionEn: "",
  price: "",
  category: "Mains",
  color: "sunset",
};
const emptyUserForm = { username: "", password: "" };
const emptyPasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

const call = (method, ...args) => Meteor.callAsync(method, ...args);

const LoginPage = ({ language, t, onLanguageToggle }) => {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const previousLanguage = useRef(language);

  useEffect(() => {
    if (previousLanguage.current !== language) {
      const previous = previousLanguage.current;
      setError((message) => retranslateMessage(previous, language, message));
      previousLanguage.current = language;
    }
  }, [language]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await Meteor.loginWithPasswordAsync(username.trim(), password);
      } else {
        const result = await call("users.register", username.trim(), password);
        setError(t(result.isAdmin ? "auth.registered" : "auth.pending"));
        setMode("login");
        return;
      }
    } catch (authError) {
      if (mode === "signup" && (authError.error === "duplicate-user" || authError.reason?.toLowerCase().includes("already"))) {
        setError(t("error.duplicate"));
      } else {
        setError(translateError(language, authError, "error.login"));
      }
    }
  };

  return (
    <div className="auth-page">
      <button className="language-switch auth-language-switch" type="button" onClick={onLanguageToggle} aria-label={t("language.switch")} title={t("language.switch")}>
        <span aria-hidden="true">{language === "es" ? "🇵🇪" : "🇺🇸"}</span>
        <span>{language === "es" ? "ES" : "EN"}</span>
      </button>
      <div className="auth-card">
        <span className="brand-mark">✦</span>
        <p className="eyebrow">{t("brand.kicker")}</p>
        <h1>{mode === "login" ? t("auth.welcome") : t("auth.signup")}</h1>
        <p className="auth-copy">{t("auth.description")}</p>
        <form className="auth-form" onSubmit={submit}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t("auth.username")} aria-label={t("auth.username")} autoComplete="username" required />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={t("auth.password")} aria-label={t("auth.password")} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit">{mode === "login" ? t("auth.login") : t("auth.register")}</button>
        </form>
        <button className="text-button auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
          {mode === "login" ? t("auth.need.account") : t("auth.have.account")}
        </button>
        <a className="back-link" href="/">{t("auth.back")}</a>
      </div>
    </div>
  );
};

export const App = () => {
  const [language, setLanguage] = useState(() => {
    const savedLanguage = window.localStorage.getItem("restaurant-menu-language");
    return savedLanguage === "en" ? "en" : "es";
  });
  const t = (key, params) => translate(language, key, params);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userError, setUserError] = useState("");
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const previousLanguage = useRef(language);
  const user = useTracker(() => Meteor.user());
  useEffect(() => {
    if (previousLanguage.current !== language) {
      const previous = previousLanguage.current;
      setError((message) => retranslateMessage(previous, language, message));
      setUserError((message) => retranslateMessage(previous, language, message));
      setPasswordError((message) => retranslateMessage(previous, language, message));
      setPasswordSuccess((message) => retranslateMessage(previous, language, message));
      previousLanguage.current = language;
    }
    window.localStorage.setItem("restaurant-menu-language", language);
    document.documentElement.lang = language;
    document.title = t("app.title");
  }, [language]);
  const { items, ready } = useTracker(() => {
    const handle = Meteor.subscribe("menuItems");
    return {
      items: MenuItems.find({}, { sort: { category: 1, createdAt: 1 } }).fetch(),
      ready: handle.ready(),
    };
  });
  const adminUserData = useTracker(() => {
    if (user?.username !== "admin") return { users: [], ready: false };
    const handle = Meteor.subscribe("adminUsers");
    return {
      users: Meteor.users.find({}, { sort: { username: 1 } }).fetch(),
      ready: handle.ready(),
    };
  });
  const adminUsers = adminUserData.users;
  const editingAdminAccount = adminUsers.some(
    (account) => account._id === editingUserId && account.username === "admin",
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  };

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const saveItem = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        await call("menuItems.update", editingId, form);
      } else {
        await call("menuItems.insert", form);
      }
      resetForm();
    } catch (methodError) {
      setError(translateError(language, methodError, "error.item.save"));
    }
  };

  const editItem = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      description: item.description,
      descriptionEn: item.descriptionEn || "",
      price: String(item.price),
      category: item.category,
      color: item.color,
    });
    setError("");
  };

  const removeItem = async (id) => {
    setError("");
    try {
      await call("menuItems.remove", id);
      if (editingId === id) resetForm();
    } catch (methodError) {
      setError(translateError(language, methodError, "error.item.delete"));
    }
  };

  const toggleAvailability = async (id) => {
    setError("");
    try {
      await call("menuItems.toggleAvailability", id);
    } catch (methodError) {
      setError(translateError(language, methodError, "error.availability"));
    }
  };

  const toggleUser = async (userId, enabled) => {
    setUserError("");
    try {
      await call("users.setEnabled", userId, !enabled);
    } catch (methodError) {
      setUserError(translateError(language, methodError, "error.account.update"));
    }
  };

  const saveUser = async (event) => {
    event.preventDefault();
    setUserError("");
    try {
      if (editingUserId) {
        await call("users.update", editingUserId, userForm.username, userForm.password);
      } else {
        await call("users.create", userForm.username, userForm.password);
      }
      setUserForm(emptyUserForm);
      setEditingUserId(null);
    } catch (methodError) {
      setUserError(translateError(language, methodError, "error.account.save"));
    }
  };

  const removeUser = async (userId) => {
    const account = adminUsers.find((entry) => entry._id === userId);
    if (account && !window.confirm(t("account.delete.confirm", { username: account.username }))) return;
    setUserError("");
    try {
      await call("users.remove", userId);
      if (editingUserId === userId) {
        setEditingUserId(null);
        setUserForm(emptyUserForm);
      }
    } catch (methodError) {
      setUserError(translateError(language, methodError, "error.account.delete"));
    }
  };

  const changeOwnPassword = (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (passwordForm.newPassword.length < 6) {
      setPasswordError(t("password.short"));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t("password.mismatch"));
      return;
    }

    Accounts.changePassword(
      passwordForm.currentPassword,
      passwordForm.newPassword,
      (changeError) => {
        if (changeError) {
          setPasswordError(translateError(language, changeError, "password.failure"));
          return;
        }
        setPasswordForm(emptyPasswordForm);
        setPasswordSuccess(t("password.success"));
      },
    );
  };

  const availableItems = items.filter((item) => item.available);
  const today = new Intl.DateTimeFormat(language === "es" ? "es-PE" : "en-US", {
    day: "numeric",
    month: "long",
  }).format(new Date());
  const categoryLabel = (category) => translate(language, "categories")[category] || category;
  const chalkLabel = (color) => translate(language, "chalk.colors")[color] || color;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <div>
            <p className="eyebrow">{t("brand.kicker")}</p>
            <h1>{t("brand.title")}</h1>
          </div>
        </div>
        <div className="header-actions">
          <div className="open-status"><span /> {t("open.today")} <b>11:30 — 22:00</b>{user ? <button className="user-menu" onClick={async () => { await Meteor.logoutAsync(); window.location.href = "/"; }} aria-label={t("logout")}>{user.username} <span aria-hidden="true">🚪</span></button> : <button className="login-link" onClick={() => setShowLogin(true)}>{t("login.open")}</button>}</div>
          <button className="language-switch" type="button" onClick={() => setLanguage(language === "es" ? "en" : "es")} aria-label={t("language.switch")} title={t("language.switch")}>
            <span aria-hidden="true">{language === "es" ? "🇵🇪" : "🇺🇸"}</span>
            <span>{language === "es" ? "ES" : "EN"}</span>
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="hero-copy">
          <p className="eyebrow">{t("hero.kicker", { date: today })}</p>
          <h2>{t("hero.title.first")}<br /><em>{t("hero.title.second")}</em></h2>
          <p className="intro">{t("hero.description")}</p>
          <div className="counter-note">
            <span className="live-dot" /> <strong>{t("items.available", { count: availableItems.length })}</strong>
          </div>
        </section>

        <section className="easel" aria-label={t("menu.aria")}>
          <div className="easel-top"><span /><span /><span /></div>
          <div className="board" tabIndex={0} aria-label={t("menu.aria")}>
            <div className="board-header">
              <span>{t("menu.today")}</span>
              <span className="board-date">{t("menu.established")}</span>
            </div>
            {!ready ? <p className="board-empty">{t("menu.loading")}</p> : availableItems.length === 0 ? (
              <p className="board-empty">{t("menu.empty")}</p>
            ) : (
              <div className="menu-list">
                {availableItems.map((item) => (
                  <article className={`menu-item chalk-${item.color}`} key={item._id}>
                    <div className="item-heading"><h3>{item.name}</h3><span className="price">S/. {item.price.toFixed(2)}</span></div>
                    <p>{language === "en" ? item.descriptionEn || item.description : item.description}</p>
                    <span className="category">{categoryLabel(item.category)}</span>
                  </article>
                ))}
              </div>
            )}
            <div className="board-footer">{t("menu.footer")}</div>
          </div>
          <div className="easel-legs"><span /><span /></div>
        </section>

        {user && <section className="admin-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">{t("console.title", { username: user.username })}</p><h2>{t("console.manage")}</h2></div>
            {user.username === "admin" && <span className="admin-badge">{t("admin.badge")}</span>}
            <span className="sync-badge"><span /> {t("sync.live")}</span>
          </div>
          <form className="item-form" onSubmit={saveItem}>
            <input name="name" value={form.name} onChange={updateForm} placeholder={t("item.name")} aria-label={t("item.name")} required />
            <textarea name="description" value={form.description} onChange={updateForm} placeholder={t("item.description.es")} aria-label={t("item.description.es")} required />
            <textarea name="descriptionEn" value={form.descriptionEn} onChange={updateForm} placeholder={t("item.description.en")} aria-label={t("item.description.en")} />
            <div className="form-row">
              <input name="price" value={form.price} onChange={updateForm} type="number" min="0" step="0.01" placeholder={t("item.price")} aria-label={t("item.price")} required />
              <select name="category" value={form.category} onChange={updateForm} aria-label={t("item.category")}>
                <option value="Mains">{t("category.mains")}</option><option value="Small plates">{t("category.small")}</option><option value="Soups">{t("category.soups")}</option><option value="Drinks">{t("category.drinks")}</option><option value="Desserts">{t("category.desserts")}</option>
              </select>
            </div>
            <div className="chalk-picker" aria-label={t("chalk.aria")}>
              {chalkColors.map((color) => <button type="button" key={color} className={`chalk-swatch chalk-${color} ${form.color === color ? "selected" : ""}`} onClick={() => setForm((current) => ({ ...current, color }))} aria-label={t("chalk.color", { color: chalkLabel(color) })} />)}
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions">
              <button className="primary-button" type="submit">{editingId ? t("item.save") : t("item.add")}</button>
              {editingId && <button className="text-button" type="button" onClick={resetForm}>{t("common.cancel")}</button>}
            </div>
          </form>
          <div className="inventory">
            <h3>{t("inventory.title")} <span>{items.length}</span></h3>
            {items.map((item) => (
              <div className={`inventory-item ${!item.available ? "unavailable" : ""}`} key={item._id}>
                <span className={`mini-swatch chalk-${item.color}`} /><div><strong>{item.name}</strong><small>{categoryLabel(item.category)} · ${item.price.toFixed(2)}</small></div>
                <div className="inventory-actions">
                  <button className="availability" onClick={() => toggleAvailability(item._id)}>{item.available ? t("availability.on") : t("availability.soldout")}</button>
                  <button className="icon-button" onClick={() => editItem(item)} aria-label={`${t("item.edit")} ${item.name}`}>{t("item.edit")}</button>
                  <button className="icon-button danger" onClick={() => removeItem(item._id)} aria-label={`${t("item.delete")} ${item.name}`}>{t("item.delete")}</button>
                </div>
              </div>
            ))}
          </div>
          {user.username !== "admin" && <form className="password-panel" onSubmit={changeOwnPassword}>
            <div className="password-panel-heading">
              <div>
                <p className="eyebrow">{t("password.kicker")}</p>
                <h3>{t("password.title")}</h3>
              </div>
              <span aria-hidden="true">🔒</span>
            </div>
            <p className="password-help">{t("password.help", { username: user.username })}</p>
            <div className="password-fields">
              <input
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                placeholder={t("password.current")}
                aria-label={t("password.current")}
                required
              />
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                placeholder={t("password.new")}
                aria-label={t("password.new")}
                required
              />
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder={t("password.confirm")}
                aria-label={t("password.confirm")}
                required
              />
            </div>
            {passwordError && <p className="form-error">{passwordError}</p>}
            {passwordSuccess && <p className="form-success">{passwordSuccess}</p>}
            <button className="primary-button" type="submit">{t("password.update")}</button>
          </form>}
        </section>}
      </main>
      {user?.username === "admin" && <section className="accounts-panel">
        <div className="accounts-heading">
          <div>
            <p className="eyebrow">{t("accounts.kicker")}</p>
            <h2>{t("accounts.title")}</h2>
            <p className="accounts-intro">{t("accounts.description")}</p>
          </div>
          <span className="accounts-count">{adminUsers.length}<small> {t("accounts.count")}</small></span>
        </div>
        <div className="accounts-content">
          {!editingAdminAccount && <form className="account-form" onSubmit={saveUser}>
            <h3>{editingUserId ? t("account.edit") : t("account.create")}</h3>
            <label>
              <span>{t("account.username")}</span>
              <input value={userForm.username} onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))} placeholder={t("account.username.placeholder")} aria-label={t("account.username")} required />
            </label>
            <label>
              <span>{editingUserId ? t("account.password.optional") : t("account.password.temporary")}</span>
              <input value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} type="password" placeholder={editingUserId ? t("account.password.keep") : t("account.password.hint")} aria-label={t("auth.password")} required={!editingUserId} />
            </label>
            {userError && <p className="form-error">{userError}</p>}
            <div className="account-form-actions">
              <button className="primary-button" type="submit">{editingUserId ? t("account.save") : t("account.create.button")}</button>
              {editingUserId && <button className="text-button" type="button" onClick={() => { setEditingUserId(null); setUserForm(emptyUserForm); setUserError(""); }}>{t("common.cancel")}</button>}
            </div>
            {!editingUserId && <p className="account-hint">{t("account.new.hint")}</p>}
          </form>}
          <div className="account-list">
            <div className="account-list-heading">
              <div><h3>{t("account.list.title")}</h3><p>{t("account.list.description")}</p></div>
            </div>
            {!adminUserData.ready ? <p className="accounts-empty">{t("account.loading")}</p> : adminUsers.length === 0 ? (
              <p className="accounts-empty">{t("account.empty")}</p>
            ) : adminUsers.map((account) => {
              const enabled = account.enabled !== false;
              return (
                <article className={`account-row ${!enabled ? "account-disabled" : ""}`} key={account._id}>
                  <div className="user-avatar">{account.username.slice(0, 1).toUpperCase()}</div>
                  <div className="account-identity">
                    <strong>{account.username}</strong>
                    <small>{account.username === "admin" ? t("account.admin") : enabled ? t("account.enabled") : t("account.pending")}</small>
                  </div>
                  <button className={`account-switch ${enabled ? "is-on" : ""}`} disabled={account.username === "admin"} onClick={() => toggleUser(account._id, enabled)} aria-label={`${enabled ? t("account.disable") : t("account.enable")} ${account.username}`}>
                    <span /> {enabled ? t("account.enabled") : t("account.pending.short")}
                  </button>
                  <div className="account-actions">
                    {account.username !== "admin" && <button className="account-action" onClick={() => { setEditingUserId(account._id); setUserForm({ username: account.username, password: "" }); setUserError(""); }}>{t("item.edit")}</button>}
                    <button className="account-action delete-action" disabled={account.username === "admin"} onClick={() => removeUser(account._id)} aria-label={`${t("item.delete")} ${account.username}`}>{t("item.delete")}</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>}
      <footer className="site-footer">
        <span className="footer-tagline">{t("footer.line")} {/*<i>·</i> {t("footer.end")}*/}</span>
        <span className="footer-copyright">© 2026 ClearSkies Web Labs</span>
        <span className="footer-credit">
          {/*{t("footer.credit")} <i>·</i>*/} <span className="footer-phone" aria-hidden="true">📱</span> +51 996852408
        </span>
      </footer>
      {showLogin && !user && <div className="auth-overlay"><LoginPage language={language} t={t} onLanguageToggle={() => setLanguage(language === "es" ? "en" : "es")} /></div>}
    </div>
  );
};

