const mongoose = require("mongoose");
const Contact = require("../models/Contact");

const MAX_CONTACTS_PER_USER = 5;

const normalizeEmail = (email) => email.trim().toLowerCase();

const normalizePhone = (phone) => phone.trim();

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone) =>
  /^[0-9+()\-\s]{7,20}$/.test(phone);

const isValidPriority = (priority) =>
  Number.isInteger(priority) && priority >= 1 && priority <= 5;

const buildContactPayload = (body) => {
  const payload = {};

  if (body.name !== undefined) {
    payload.name = String(body.name).trim();
  }

  if (body.relation !== undefined) {
    payload.relation = String(body.relation).trim();
  }

  if (body.phone !== undefined) {
    payload.phone = normalizePhone(String(body.phone));
  }

  if (body.email !== undefined) {
    payload.email = normalizeEmail(String(body.email));
  }

  if (body.priority !== undefined) {
    payload.priority = Number(body.priority);
  }

  if (body.isPrimary !== undefined) {
    payload.isPrimary = body.isPrimary === true || body.isPrimary === "true";
  }

  return payload;
};

const validateContactPayload = (payload, requireAllFields = false) => {
  const requiredFields = ["name", "relation", "phone", "email", "priority"];

  if (requireAllFields) {
    const missingFields = requiredFields.filter(
      (field) => payload[field] === undefined || payload[field] === ""
    );

    if (missingFields.length > 0) {
      return `Missing required fields: ${missingFields.join(", ")}`;
    }
  }

  if (payload.name !== undefined && !payload.name) {
    return "Name is required.";
  }

  if (payload.relation !== undefined && !payload.relation) {
    return "Relation is required.";
  }

  if (payload.phone !== undefined && !isValidPhone(payload.phone)) {
    return "Enter a valid phone number.";
  }

  if (payload.email !== undefined && !isValidEmail(payload.email)) {
    return "Enter a valid email address.";
  }

  if (payload.priority !== undefined && !isValidPriority(payload.priority)) {
    return "Priority must be an integer between 1 and 5.";
  }

  return null;
};

const createContact = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    const payload = buildContactPayload(req.body);
    const validationError = validateContactPayload(payload, true);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const contactCount = await Contact.countDocuments({ user: userId });

    if (contactCount >= MAX_CONTACTS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: "Contact limit reached. You can save up to 5 emergency contacts.",
      });
    }

    const duplicateContact = await Contact.findOne({
      user: userId,
      $or: [{ phone: payload.phone }, { email: payload.email }],
    });

    if (duplicateContact) {
      return res.status(409).json({
        success: false,
        message: "A contact with the same phone or email already exists.",
      });
    }

    if (payload.isPrimary) {
      await Contact.updateMany(
        { user: userId },
        { $set: { isPrimary: false } }
      );
    }

    const contact = await Contact.create({
      user: userId,
      ...payload,
    });

    return res.status(201).json({
      success: true,
      message: "Emergency contact created successfully.",
      contact,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A contact with the same phone or email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create emergency contact.",
    });
  }
};

const getContacts = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    const contacts = await Contact.find({ user: userId })
      .sort({ isPrimary: -1, priority: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: contacts.length,
      contacts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch emergency contacts.",
    });
  }
};

const getContactById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact id.",
      });
    }

    const contact = await Contact.findOne({ _id: id, user: userId });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found.",
      });
    }

    return res.status(200).json({
      success: true,
      contact,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch the emergency contact.",
    });
  }
};

const updateContact = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact id.",
      });
    }

    const contact = await Contact.findOne({ _id: id, user: userId });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found.",
      });
    }

    const payload = buildContactPayload(req.body);

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const validationError = validateContactPayload(payload, false);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    if (payload.phone || payload.email) {
      const duplicateContact = await Contact.findOne({
        user: userId,
        _id: { $ne: id },
        $or: [
          payload.phone ? { phone: payload.phone } : null,
          payload.email ? { email: payload.email } : null,
        ].filter(Boolean),
      });

      if (duplicateContact) {
        return res.status(409).json({
          success: false,
          message: "A contact with the same phone or email already exists.",
        });
      }
    }

    Object.assign(contact, payload);

    if (payload.isPrimary) {
      await Contact.updateMany(
        { user: userId, _id: { $ne: contact._id } },
        { $set: { isPrimary: false } }
      );
    }

    await contact.save();

    return res.status(200).json({
      success: true,
      message: "Emergency contact updated successfully.",
      contact,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A contact with the same phone or email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update emergency contact.",
    });
  }
};

const deleteContact = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact id.",
      });
    }

    const deletedContact = await Contact.findOneAndDelete({
      _id: id,
      user: userId,
    });

    if (!deletedContact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Emergency contact deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to delete emergency contact.",
    });
  }
};

module.exports = {
  createContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
};