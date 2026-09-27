import { Accounts } from "meteor/accounts-base";
import { Meteor } from "meteor/meteor";
import { MenuItems } from "/imports/api/menuItems";

const colors = ["sunset", "sky", "mint", "lemon", "coral", "lavender"];

const validateItem = ({ name, description, descriptionEn = "", price, category, color }) => {
  if (typeof name !== "string" || !name.trim()) {
    throw new Meteor.Error("invalid-item", "A dish name is required.");
  }
  if (typeof description !== "string" || !description.trim()) {
    throw new Meteor.Error("invalid-item", "A description is required.");
  }
  if (typeof descriptionEn !== "string") {
    throw new Meteor.Error("invalid-item", "The English description must be text.");
  }
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice < 0) {
    throw new Meteor.Error("invalid-item", "Price must be a positive number.");
  }
  if (typeof category !== "string" || !category.trim()) {
    throw new Meteor.Error("invalid-item", "A category is required.");
  }
  if (!colors.includes(color)) {
    throw new Meteor.Error("invalid-item", "Choose a valid chalk color.");
  }

  return {
    name: name.trim(),
    description: description.trim(),
    descriptionEn: descriptionEn.trim(),
    price: Math.round(numericPrice * 100) / 100,
    category: category.trim(),
    color,
  };
};

const requireUser = function requireUser() {
  if (!this.userId) {
    throw new Meteor.Error("not-authorized", "Please log in to manage the menu.");
  }
};

const requireAdmin = async function requireAdmin() {
  requireUser.call(this);
  const user = await Meteor.users.findOneAsync(this.userId, { fields: { username: 1 } });
  if (user?.username !== "admin") {
    throw new Meteor.Error("not-authorized", "Only the admin user can manage accounts.");
  }
};

Accounts.onCreateUser((options, user) => ({
  ...user,
  profile: options.profile || {},
  enabled: user.username === "admin",
}));

Accounts.validateLoginAttempt(async (attempt) => {
  if (attempt.user && attempt.user.username !== "admin" &&
      !await Meteor.users.findOneAsync({ username: "admin" }, { fields: { _id: 1 } })) {
    throw new Meteor.Error("admin-required", "An administrator must be created before other accounts can log in.");
  }
  if (attempt.user && attempt.user.enabled === false) {
    throw new Meteor.Error("account-disabled", "This account has been disabled by the admin.");
  }
  return true;
});

Meteor.publish("menuItems", function publishMenuItems() {
  return MenuItems.find({}, { sort: { createdAt: 1 } });
});

Meteor.publish("adminUsers", async function publishAdminUsers() {
  if (!this.userId) return this.ready();
  const user = await Meteor.users.findOneAsync(this.userId, { fields: { username: 1 } });
  if (user?.username !== "admin") return this.ready();
  return Meteor.users.find({}, {
    fields: { username: 1, createdAt: 1, enabled: 1 },
    sort: { username: 1 },
  });
});

Meteor.methods({
  async "users.register"(username, password) {
    if (this.userId) {
      throw new Meteor.Error("invalid-user", "Log out before creating another account.");
    }
    if (typeof username !== "string" || !/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())) {
      throw new Meteor.Error("invalid-user", "Username must be 3–30 letters, numbers, dots, underscores, or hyphens.");
    }
    if (typeof password !== "string" || password.length < 6) {
      throw new Meteor.Error("invalid-user", "Password must be at least 6 characters.");
    }
    const normalizedUsername = username.trim();
    if (await Meteor.users.findOneAsync({ username: normalizedUsername }, { fields: { _id: 1 } })) {
      throw new Meteor.Error("duplicate-user", "That username is already registered.");
    }
    await Accounts.createUserAsync({ username: normalizedUsername, password });
    return { isAdmin: normalizedUsername === "admin" };
  },

  async "users.create"(username, password) {
    await requireAdmin.call(this);
    if (typeof username !== "string" || !/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())) {
      throw new Meteor.Error("invalid-user", "Username must be 3–30 letters, numbers, dots, underscores, or hyphens.");
    }
    if (typeof password !== "string" || password.length < 6) {
      throw new Meteor.Error("invalid-user", "Password must be at least 6 characters.");
    }
    const normalizedUsername = username.trim();
    if (await Meteor.users.findOneAsync({ username: normalizedUsername }, { fields: { _id: 1 } })) {
      throw new Meteor.Error("duplicate-user", "That username is already registered.");
    }
    await Accounts.createUserAsync({ username: normalizedUsername, password });
    return { message: "User created. Enable the account when it is ready to log in." };
  },

  async "users.update"(userId, username, password) {
    await requireAdmin.call(this);
    if (typeof userId !== "string" || typeof username !== "string" || !username.trim()) {
      throw new Meteor.Error("invalid-user", "A valid username is required.");
    }
    const target = await Meteor.users.findOneAsync(userId, { fields: { username: 1 } });
    if (!target) throw new Meteor.Error("not-found", "That user no longer exists.");
    const normalizedUsername = username.trim();
    const duplicate = await Meteor.users.findOneAsync(
      { username: normalizedUsername, _id: { $ne: userId } },
      { fields: { _id: 1 } },
    );
    if (duplicate) throw new Meteor.Error("duplicate-user", "That username is already registered.");
    const updates = { username: normalizedUsername };
    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 6) {
        throw new Meteor.Error("invalid-user", "Password must be at least 6 characters.");
      }
      await Accounts.setPasswordAsync(userId, password);
    }
    return Meteor.users.updateAsync(userId, { $set: updates });
  },

  async "users.remove"(userId) {
    await requireAdmin.call(this);
    if (userId === this.userId) {
      throw new Meteor.Error("invalid-user", "The admin account cannot delete itself.");
    }
    const removed = await Meteor.users.removeAsync(userId);
    if (!removed) throw new Meteor.Error("not-found", "That user no longer exists.");
    return removed;
  },

  async "users.setEnabled"(userId, enabled) {
    await requireAdmin.call(this);
    if (userId === this.userId) {
      throw new Meteor.Error("invalid-user", "The admin account cannot be disabled.");
    }
    if (typeof userId !== "string" || typeof enabled !== "boolean") {
      throw new Meteor.Error("invalid-user", "Invalid account status.");
    }
    const updated = await Meteor.users.updateAsync(userId, { $set: { enabled } });
    if (!updated) throw new Meteor.Error("not-found", "That user no longer exists.");
    return updated;
  },

  async "menuItems.insert"(item) {
    requireUser.call(this);
    const now = new Date();
    return MenuItems.insertAsync({
      ...validateItem(item),
      available: true,
      createdAt: now,
      updatedAt: now,
    });
  },

  async "menuItems.update"(id, item) {
    requireUser.call(this);
    if (typeof id !== "string" || !id) {
      throw new Meteor.Error("invalid-item", "A menu item id is required.");
    }
    const updated = await MenuItems.updateAsync(
      { _id: id },
      { $set: { ...validateItem(item), updatedAt: new Date() } },
    );
    if (!updated) {
      throw new Meteor.Error("not-found", "That menu item no longer exists.");
    }
    return updated;
  },

  async "menuItems.toggleAvailability"(id) {
    requireUser.call(this);
    const item = await MenuItems.findOneAsync(id);
    if (!item) {
      throw new Meteor.Error("not-found", "That menu item no longer exists.");
    }
    return MenuItems.updateAsync(
      { _id: id },
      { $set: { available: !item.available, updatedAt: new Date() } },
    );
  },

  async "menuItems.remove"(id) {
    requireUser.call(this);
    if (typeof id !== "string" || !id) {
      throw new Meteor.Error("invalid-item", "A menu item id is required.");
    }
    const removed = await MenuItems.removeAsync(id);
    if (!removed) {
      throw new Meteor.Error("not-found", "That menu item no longer exists.");
    }
    return removed;
  },
});

Meteor.startup(async () => {
  await Meteor.users.rawCollection().updateMany(
    { username: { $ne: "admin" }, enabled: { $ne: false } },
    { $set: { enabled: false } },
  );
});
